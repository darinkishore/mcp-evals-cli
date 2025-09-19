import { useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import type { TraceBrowseItem } from "../types.ts";
import { listTraces } from "../api.ts";
import { BottomDetailsPane, Header, TranscriptView } from "./index.ts";
import { compareForFailuresMode, matchesFailuresOnly } from "./reviewFilter.ts";

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
  const computeViewItems = (source: TraceBrowseItem[]) => {
    if (!failuresOnly) return source;
    const filtered = source.filter(matchesFailuresOnly);
    filtered.sort(compareForFailuresMode);
    return filtered;
  };
  const items = useMemo(() => computeViewItems(poolItems), [
    poolItems,
    failuresOnly,
  ]);

  const current: TraceBrowseItem | null = items.length
    ? items[Math.max(0, Math.min(index, items.length - 1))]
    : null;

  const [showSummaries, setShowSummaries] = useState(false);
  const [viewMode, setViewMode] = useState<"normal" | "transcript">(
    "normal",
  );
  const [transcriptOffset, setTranscriptOffset] = useState(0);
  const [bottomOffset, setBottomOffset] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const pageSize = 25;

  const advanceOrLoadMore = async () => {
    if (index < items.length - 1) {
      setIndex(index + 1);
      return;
    }
    if (total !== null && offset >= total) {
      setNotice("End of list");
      return;
    }
    try {
      setLoading(true);
      const res = await listTraces(offset, pageSize);
      const fetched = res.items as TraceBrowseItem[];
      const newItems = [...poolItems, ...fetched];
      setPoolItems(newItems);
      const newOffset = res.offset + fetched.length;
      setOffset(newOffset);
      setTotal(res.total);
      const newView = computeViewItems(newItems);
      if (index < newView.length - 1) {
        setIndex(index + 1);
      } else {
        const totalCount = res.total ?? total;
        if (
          totalCount !== null && totalCount !== undefined &&
          newOffset >= totalCount
        ) {
          setNotice("End of list");
        }
      }
    } catch (e) {
      setError((e as Error).message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      setLoading(true);
      setError(null);
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
    const ch = (inp ?? "").toLowerCase();

    if (key.ctrl && (inp === "t" || inp === "T")) {
      setViewMode((mode) => mode === "transcript" ? "normal" : "transcript");
      setNotice(null);
      return;
    }

    if (viewMode === "transcript") {
      const visibleRows = (rows ?? 24) - 3 - 1; // header + hints
      const step = Math.max(1, Math.floor(visibleRows / 2));
      if (ch === "q") {
        exit();
        return;
      }
      if (key.rightArrow || (key.tab && !key.shift) || ch === "l") {
        setNotice(null);
        await advanceOrLoadMore();
        return;
      }
      if (key.leftArrow || (key.tab && key.shift) || ch === "h") {
        setNotice(null);
        if (index > 0) setIndex(index - 1);
        return;
      }
      if (key.downArrow || ch === "j") {
        setTranscriptOffset((n) => n + 1);
        return;
      }
      if (key.upArrow || ch === "k") {
        setTranscriptOffset((n) => Math.max(0, n - 1));
        return;
      }
      if (key.pageDown) {
        setTranscriptOffset((n) => n + step);
        return;
      }
      if (key.pageUp) {
        setTranscriptOffset((n) => Math.max(0, n - step));
        return;
      }
      if (ch === "g") {
        setTranscriptOffset(0);
        return;
      }
      if (ch === "s") {
        setShowSummaries((prev) => {
          const next = !prev;
          setNotice(next ? "Summaries on" : "Summaries off");
          return next;
        });
        return;
      }
      if (ch === "q" || key.escape) {
        setViewMode("normal");
        return;
      }
      return;
    }

    if (ch === "q") {
      exit();
      return;
    }
    if (key.rightArrow || (key.tab && !key.shift)) {
      setNotice(null);
      await advanceOrLoadMore();
      return;
    }
    if (key.leftArrow || (key.tab && key.shift)) {
      setNotice(null);
      if (index > 0) setIndex(index - 1);
      return;
    }
    if (key.downArrow || ch === "j") {
      setBottomOffset((n) => n + 1);
      return;
    }
    if (key.upArrow || ch === "k") {
      setBottomOffset((n) => Math.max(0, n - 1));
      return;
    }
    if (key.pageDown) {
      const step = Math.max(3, Math.floor((rows ?? 24) / 4));
      setBottomOffset((n) => n + step);
      return;
    }
    if (key.pageUp) {
      const step = Math.max(3, Math.floor((rows ?? 24) / 4));
      setBottomOffset((n) => Math.max(0, n - step));
      return;
    }
    if (ch === "g") {
      setBottomOffset(0);
      return;
    }
    if (ch === "s" || ch === "S") {
      setShowSummaries((prev) => {
        const next = !prev;
        setNotice(next ? "Summaries on" : "Summaries off");
        return next;
      });
      return;
    }
    if (ch === "t") {
      setViewMode("transcript");
      setTranscriptOffset(0);
    }
  });

  const controls = useMemo(() => (
    <Text>
      [←] prev [→] next [Tab] next [Shift+Tab] prev [↑/↓ PgUp/PgDn] scroll
      {failuresOnly ? "   (Filtered: failures only)" : ""}
      {`   [S] summaries ${showSummaries ? "on" : "off"}`}
      {"   [Ctrl+T] transcript   [q] quit"}
    </Text>
  ), [showSummaries, failuresOnly]);

  if (loading) return <Text color="gray">Loading…</Text>;
  if (error) return <Text color="red">{error}</Text>;
  if (!current) return <Text color="yellow">No traces to view.</Text>;

  const totalRows = rows ?? 24;
  const controlsLines = 1;
  const noticeLines = notice ? 1 : 0;
  const headerRows = 5;
  const verticalGaps = 2;
  const reservedBottom = Math.max(2, controlsLines + noticeLines + 1);
  const paneHeight = Math.max(
    4,
    totalRows - reservedBottom - headerRows - verticalGaps,
  );

  if (viewMode === "transcript" && current) {
    return (
      <TranscriptView
        t={current}
        rows={totalRows}
        cols={colsProp}
        offset={transcriptOffset}
        onOffsetChange={(n) => setTranscriptOffset(n)}
        showSummaries={showSummaries}
        notice={notice ?? undefined}
      />
    );
  }

  return (
    <Box flexDirection="column" height={totalRows} justifyContent="center">
      <Box flexDirection="column" gap={1}>
        <Header t={current} />

        <Box flexDirection="column" gap={0} flexGrow={1}>
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="cyan"
            paddingX={1}
            height={paneHeight}
          >
            <BottomDetailsPane
              issues={current.issues ?? []}
              requirements={current.requirements ?? []}
              height={paneHeight}
              offset={bottomOffset}
              onOffsetChange={(n) => setBottomOffset(n)}
              showSummaries={showSummaries}
            />
          </Box>
        </Box>

        {controls}
        {notice && <Text color="yellow">{notice}</Text>}
      </Box>
    </Box>
  );
}

// Filtering & sorting helpers are imported from reviewFilter.ts
