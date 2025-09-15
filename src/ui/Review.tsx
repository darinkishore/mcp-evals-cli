import { useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import type { TraceBrowseItem } from "../types.ts";
import { listTraces, postAsk, postFeedback } from "../api.ts";
import { AskAnswer, CommandBar, Header, Issues, Requirements, TraceExcerpt } from "./index.ts";
import { compareForFailuresMode, matchesFailuresOnly } from "./reviewFilter.ts";
import { icons } from "./theme.ts";

function isBackspace(inp: string, key: any): boolean {
  // Handle various backspace/delete signals across terminals
  // - key.backspace (if provided by Ink)
  // - key.delete (some terminals map backspace to delete)
  // - ASCII BS (\b) and DEL (\x7f)
  // - Ctrl+H (common backspace mapping)
  if (key?.backspace || key?.delete) return true;
  if (inp === "\b" || inp === "\x7f") return true;
  if (key?.ctrl && inp?.toLowerCase() === "h") return true;
  return false;
}

type ComposeMode = "feedback" | "ask";

interface ReviewProps {
  rows?: number;
  cols?: number;
  failuresOnly?: boolean;
}

export default function ReviewApp(
  { rows, cols: colsProp, failuresOnly = false }: ReviewProps,
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
  // Compose state (global-ish within this viewer): default to feedback
  const [composeMode, setComposeMode] = useState<ComposeMode>("feedback");
  const [input, setInput] = useState("");
  const [justSwitchedToAsk, setJustSwitchedToAsk] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
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
    // If in Ask mode and backspace at empty input, return to Feedback
    if (composeMode === "ask" && isBackspace(inp, key) && input.length === 0) {
      setComposeMode("feedback");
      setConfirmDiscard(false);
      return;
    }

    // Compose capture rules: when there's text, ignore nav keys except Esc/Enter flow
    const hasDraft = input.trim().length > 0;
    if (hasDraft) {
      // Handle discard confirmation
      if (key.escape) {
        if (!confirmDiscard) {
          setConfirmDiscard(true);
        } else {
          // confirmed discard
          setInput("");
          setConfirmDiscard(false);
        }
        return;
      }
      if (key.return) {
        // keep draft; cancel discard prompt if showing
        if (confirmDiscard) setConfirmDiscard(false);
        return; // onSubmit handled by TextInput
      }
      // Swallow other keys (let TextInput handle printable keys)
      return;
    }

    // When no draft, allow global nav + quick mode switches
    const ch = inp.toLowerCase();
    if (ch === "q") {
      exit();
    } else if (key.rightArrow || (key.tab && !key.shift)) {
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
    } else if (key.leftArrow || (key.tab && key.shift)) {
      // Previous item (viewer)
      setAskAnswer(null);
      setNotice(null);
      if (index > 0) setIndex(index - 1);
    } else if (ch === "?" || inp === "?") {
      setComposeMode("ask");
      setJustSwitchedToAsk(true);
      setInput("");
    } else if (ch === "s") {
      setShowSummaries(!showSummaries);
      setNotice(
        showSummaries ? "Showing full descriptions" : "Showing summaries",
      );
    }
  });

  const clearNoticeSoon = () => {
    setTimeout(() => setNotice(null), 1500);
  };

  const onSubmitAsk = async (text?: string) => {
    if (!current) return;
    const q = (text ?? input).trim();
    if (!q) return;
    try {
      const ans = await postAsk(current.trace_id, q);
      setAskAnswer(ans.answer);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInput("");
      setComposeMode("feedback"); // return to default
      setConfirmDiscard(false);
    }
  };

  const onSubmitFeedback = async (text?: string) => {
    if (!current) return;
    const fb = (text ?? input).trim();
    if (!fb) return;
    try {
      await postFeedback(current.trace_id, fb);
      setNotice("Noted.");
      clearNoticeSoon();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInput("");
      setConfirmDiscard(false);
    }
  };

  const controls = useMemo(() => (
    <Text>
      [←] prev [→] next [Tab] next [Shift+Tab] prev [?]ask [q]uit{failuresOnly
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
  // Dynamically reserve space for the bottom area to avoid collapsing the command bar
  const askLines = askAnswer ? (askAnswer.split("\n").length + 3) : 0; // rough: 1 title + content + 2 border lines
  const cmdBarLines = 3; // top rule, input row, bottom rule
  const controlsLines = 1;
  const noticeLines = notice ? 1 : 0;
  const desiredReserved = cmdBarLines + controlsLines + noticeLines + askLines;
  const headerRows = 5; // approx: boxed header with 3 lines + borders
  const verticalGaps = 2; // gaps between sections
  const maxReserved = Math.max(0, totalRows - headerRows - verticalGaps - 4);
  const reservedBottom = Math.min(maxReserved, Math.max(5, desiredReserved));
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
          {/* Left bottom box: Review Details (Issues first per spec) */}
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="cyan"
            paddingX={1}
            flexGrow={3}
            height={paneHeight}
          >
            <Text>{icons.details}</Text>
            <Issues
              issues={current.issues ?? []}
              boxed={false}
              showSummaries={showSummaries}
            />
            <Requirements requirements={current.requirements ?? []} />
          </Box>

          {/* Right bottom box: Trace */}
          <Box flexDirection="column" flexGrow={2}>
            <TraceExcerpt messages={current.messages} height={paneHeight} />
          </Box>
        </Box>

        {/* Footer: pinned ask answer (Phase 1: simple card) */}
        {askAnswer && <AskAnswer askAnswer={askAnswer} />}

        {/* Controls hint */}
        {controls}

        {/* Persistent command bar */}
        <CommandBar
          cols={colsProp}
          mode={composeMode}
          value={input}
          setValue={(v) => {
            // If we just switched to ask via '?' and the input captured a stray '?', drop it
            if (justSwitchedToAsk && v === "?") {
              setInput("");
              setJustSwitchedToAsk(false);
              return;
            }
            setJustSwitchedToAsk(false);
            setInput(v);
            if (confirmDiscard) setConfirmDiscard(false);
          }}
          onSubmitAsk={(t) => onSubmitAsk(t)}
          onSubmitFeedback={(t) => onSubmitFeedback(t)}
          message={notice}
          confirmDiscard={confirmDiscard}
        />
      </Box>
    </Box>
  );
}

// Filtering & sorting helpers are imported from reviewFilter.ts
