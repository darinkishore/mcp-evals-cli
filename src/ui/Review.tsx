import { useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import type { TraceBrowseItem } from "../types.ts";
import { listTraces, postAsk, postFeedback } from "../api.ts";
import {
  AskAnswer,
  Header,
  InputControls,
  Issues,
  Requirements,
  TraceExcerpt,
} from "./index.ts";
import { compareForFailuresMode, matchesFailuresOnly } from "./reviewFilter.ts";
import { icons } from "./theme.ts";

type Mode = "idle" | "ask" | "feedback";

interface ReviewProps {
  rows?: number;
  cols?: number;
  failuresOnly?: boolean;
}

export default function ReviewApp(
  { rows, cols: _cols, failuresOnly = false }: ReviewProps,
) {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Pool of all items loaded from the server (unfiltered)
  const [poolItems, setPoolItems] = useState<TraceBrowseItem[]>([]);
  const [index, setIndex] = useState(0);
  // Derived filtered/sorted items (for view)
  const items = useMemo(() => {
    if (!failuresOnly) return poolItems;
    // Filter+sort for failures mode
    const arr = poolItems.slice();
    const filtered = arr.filter(matchesFailuresOnly);
    filtered.sort(compareForFailuresMode);
    return filtered;
  }, [poolItems, failuresOnly]);

  const current: TraceBrowseItem | null = items.length
    ? items[Math.max(0, Math.min(index, items.length - 1))]
    : null;
  const [mode, setMode] = useState<Mode>("idle");
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [showSummaries, setShowSummaries] = useState(true);
  const pageSize = 25;

  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      setLoading(true);
      setError(null);
      setAskAnswer(null);
      setNotice(null);
      try {
        const res = await listTraces(0, pageSize);
        if (cancelled) return;
        setPoolItems(res.items as TraceBrowseItem[]);
        setOffset(res.offset + res.items.length);
        setTotal(res.total);
        setIndex(0);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  useInput(async (inp, key) => {
    if (mode !== "idle") return; // handled by input field
    if (key.escape) {
      setMode("idle");
      setInput("");
      return;
    }
    const ch = inp.toLowerCase();
    if (ch === "q") {
      exit();
    } else if (ch === "l" || key.rightArrow) {
      // Next item (viewer)
      setAskAnswer(null);
      setNotice(null);
      if (index < items.length - 1) {
        setIndex(index + 1);
        return;
      }
      // Need to fetch more if available
      if (total !== null && offset >= total) {
        setNotice("End of list");
        return;
      }
      try {
        setLoading(true);
        const res = await listTraces(offset, pageSize);
        const newItems = [...poolItems, ...(res.items as TraceBrowseItem[])];
        setPoolItems(newItems);
        setOffset(res.offset + res.items.length);
        setTotal(res.total);
        // After new data, try to advance if possible
        const newView = failuresOnly
          ? newItems.filter(matchesFailuresOnly).sort(compareForFailuresMode)
          : newItems;
        if (index < newView.length - 1) {
          setIndex(index + 1);
        } else if (total !== null && (res.offset + res.items.length) >= total) {
          setNotice("End of list");
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    } else if (ch === "h" || key.leftArrow) {
      // Previous item (viewer)
      setAskAnswer(null);
      setNotice(null);
      if (index > 0) setIndex(index - 1);
    } else if (ch === "a") {
      setMode("ask");
      setInput("");
    } else if (ch === "f") {
      setMode("feedback");
      setInput("");
    } else if (ch === "s") {
      setShowSummaries(!showSummaries);
      setNotice(
        showSummaries ? "Showing full descriptions" : "Showing summaries",
      );
    }
  });

  const onSubmitAsk = async () => {
    if (!current) return;
    const q = input.trim();
    if (!q) return setMode("idle");
    try {
      const ans = await postAsk(current.trace_id, q);
      setAskAnswer(ans.answer);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMode("idle");
      setInput("");
    }
  };

  const onSubmitFeedback = async () => {
    if (!current) return;
    const fb = input.trim();
    if (!fb) return setMode("idle");
    try {
      await postFeedback(current.trace_id, fb);
      setNotice("✓ Feedback recorded");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMode("idle");
      setInput("");
    }
  };

  const controls = useMemo(() => (
    <Text>
      [H] prev [L] next [s]ummary [f]eedback [a]sk [q]uit{failuresOnly
        ? "   (Filtered: failures only)"
        : ""}
      {showSummaries ? "   (Summaries)" : "   (Full)"}
    </Text>
  ), [showSummaries, failuresOnly]);

  if (loading) return <Text color="gray">Loading…</Text>;
  if (error) return <Text color="red">{error}</Text>;
  if (!current) return <Text color="yellow">No traces to view.</Text>;

  // Approximate visible height for the content panes
  const totalRows = rows ?? 24;
  const reservedBottom = 6; // space for ask/notice/controls
  const headerRows = 5; // approx: boxed header with 3 lines + borders
  const verticalGaps = 2; // gaps between sections
  const paneHeight = Math.max(
    4,
    totalRows - reservedBottom - headerRows - verticalGaps,
  );

  return (
    <Box flexDirection="column" height={totalRows} justifyContent="center">
      <Box flexDirection="column" gap={1}>
        {/* Top: full-width header */}
        <Header t={current} />

        {/* Bottom: two boxes at the same height filling remaining space */}
        <Box flexDirection="row" gap={2} flexGrow={1}>
          {/* Left bottom box: Review Details */}
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="cyan"
            paddingX={1}
            flexGrow={3}
            height={paneHeight}
          >
            <Text>{icons.details}</Text>
            <Requirements requirements={current.requirements ?? []} />
            <Issues
              issues={current.issues ?? []}
              boxed={false}
              showSummaries={showSummaries}
            />
          </Box>

          {/* Right bottom box: Trace */}
          <Box flexDirection="column" flexGrow={2}>
            <TraceExcerpt messages={current.messages} height={paneHeight} />
          </Box>
        </Box>

        {/* Footer: ask/answer, notices, and controls */}
        {askAnswer && <AskAnswer askAnswer={askAnswer} />}

        {notice && <Text color="green">{notice}</Text>}

        <InputControls
          mode={mode}
          input={input}
          setInput={setInput}
          onSubmitAsk={onSubmitAsk}
          onSubmitFeedback={onSubmitFeedback}
          controls={controls}
        />
      </Box>
    </Box>
  );
}

// Filtering & sorting helpers are imported from reviewFilter.ts
