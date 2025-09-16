import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import type { TraceBrowseItem } from "../types.ts";
import { listTraces, postAsk, postFeedback } from "../api.ts";
import { AskAnswer, CommandBar, Header, TranscriptView, BottomDetailsPane } from "./index.ts";
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

interface UIState {
  composeMode: ComposeMode;
  draft: string;
  confirmDiscard: boolean;
  notice: string | null;
  askAnswer: string | null;
  askVisible: boolean;
  showSummaries: boolean;
  viewMode: "normal" | "transcript";
  transcriptOffset: number;
  bottomOffset: number;
}

type UIAction =
  | { type: "SET_COMPOSE_MODE"; mode: ComposeMode }
  | { type: "SET_DRAFT"; value: string }
  | { type: "CLEAR_DRAFT" }
  | { type: "SET_CONFIRM_DISCARD"; value: boolean }
  | { type: "SET_NOTICE"; value: string | null }
  | { type: "SET_ASK_ANSWER"; value: string | null }
  | { type: "SET_ASK_VISIBLE"; value: boolean }
  | { type: "TOGGLE_ASK_VISIBLE" }
  | { type: "TOGGLE_SUMMARIES" }
  | { type: "SET_VIEW_MODE"; mode: "normal" | "transcript" }
  | { type: "SET_TRANSCRIPT_OFFSET"; value: number }
  | { type: "SET_BOTTOM_OFFSET"; value: number };

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case "SET_COMPOSE_MODE":
      return { ...state, composeMode: action.mode };
    case "SET_DRAFT":
      return { ...state, draft: action.value };
    case "CLEAR_DRAFT":
      return { ...state, draft: "" };
    case "SET_CONFIRM_DISCARD":
      return { ...state, confirmDiscard: action.value };
    case "SET_NOTICE":
      return { ...state, notice: action.value };
    case "SET_ASK_ANSWER":
      return { ...state, askAnswer: action.value };
    case "SET_ASK_VISIBLE":
      return { ...state, askVisible: action.value };
    case "TOGGLE_ASK_VISIBLE":
      return { ...state, askVisible: !state.askVisible };
    case "TOGGLE_SUMMARIES":
      return { ...state, showSummaries: !state.showSummaries };
    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.mode };
    case "SET_TRANSCRIPT_OFFSET":
      return { ...state, transcriptOffset: action.value };
    case "SET_BOTTOM_OFFSET":
      return { ...state, bottomOffset: action.value };
    default:
      return state;
  }
}

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
  const items = useMemo(() => computeViewItems(poolItems), [poolItems, failuresOnly]);

  const current: TraceBrowseItem | null = items.length
    ? items[Math.max(0, Math.min(index, items.length - 1))]
    : null;
  // Centralized UI state
  const [ui, dispatch] = useReducer(uiReducer, {
    composeMode: "feedback",
    draft: "",
    confirmDiscard: false,
    notice: null,
    askAnswer: null,
    askVisible: true,
    showSummaries: true,
    viewMode: "normal",
    transcriptOffset: 0,
    bottomOffset: 0,
  } as UIState);
  const composeMode = ui.composeMode;
  const input = ui.draft;
  const confirmDiscard = ui.confirmDiscard;
  const notice = ui.notice;
  const askAnswer = ui.askAnswer;
  const askVisible = ui.askVisible;
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  // showSummaries comes from ui state
  const showSummaries = ui.showSummaries;
  const justSwitchedToAskRef = useRef(false);
  const justToggledVRef = useRef(false);
  const justToggledSRef = useRef(false);
  const pageSize = 25;

  const advanceOrLoadMore = async () => {
    if (index < items.length - 1) {
      setIndex(index + 1);
      return;
    }
    if (total !== null && offset >= total) {
      dispatch({ type: "SET_NOTICE", value: "End of list" });
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
        if (totalCount !== null && totalCount !== undefined && newOffset >= totalCount) {
          dispatch({ type: "SET_NOTICE", value: "End of list" });
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
      dispatch({ type: "SET_ASK_ANSWER", value: null });
      dispatch({ type: "SET_NOTICE", value: null });
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
    // Global toggle for Transcript Mode
    if (key.ctrl && (inp === "t" || inp === "T")) {
      dispatch({ type: "SET_VIEW_MODE", mode: ui.viewMode === "transcript" ? "normal" : "transcript" });
      return;
    }

    if (ui.viewMode === "transcript") {
      const visibleRows = (rows ?? 24) - 3 - 1; // header + hints
      const step = Math.max(1, Math.floor(visibleRows / 2));
      const ch = (inp ?? "").toLowerCase();
      if (ch === "q") { exit(); return; }
      // Navigation between traces
      if (key.rightArrow || (key.tab && !key.shift) || ch === "l") {
        dispatch({ type: "SET_ASK_ANSWER", value: null });
        dispatch({ type: "SET_NOTICE", value: null });
        await advanceOrLoadMore();
        return;
      }
      if (key.leftArrow || (key.tab && key.shift) || ch === "h") {
        dispatch({ type: "SET_ASK_ANSWER", value: null });
        dispatch({ type: "SET_NOTICE", value: null });
        if (index > 0) setIndex(index - 1);
        return;
      }
      // Scroll transcript
      if (key.downArrow || ch === "j") { dispatch({ type: "SET_TRANSCRIPT_OFFSET", value: ui.transcriptOffset + 1 }); return; }
      if (key.upArrow || ch === "k") { dispatch({ type: "SET_TRANSCRIPT_OFFSET", value: Math.max(0, ui.transcriptOffset - 1) }); return; }
      if (key.pageDown) { dispatch({ type: "SET_TRANSCRIPT_OFFSET", value: ui.transcriptOffset + step }); return; }
      if (key.pageUp) { dispatch({ type: "SET_TRANSCRIPT_OFFSET", value: Math.max(0, ui.transcriptOffset - step) }); return; }
      if (ch === "g") { dispatch({ type: "SET_TRANSCRIPT_OFFSET", value: 0 }); return; }
      if (ch === "g" && key.shift) { /* unreachable via ch; ignore */ }
      if (ch === "s") { dispatch({ type: "TOGGLE_SUMMARIES" }); return; }
      // Disabled compose actions
      if (ch === "?" || ch === "v" || key.return) {
        dispatch({ type: "SET_NOTICE", value: "Exit transcript to compose" });
        setTimeout(() => dispatch({ type: "SET_NOTICE", value: null }), 1200);
        return;
      }
      return; // block other keys
    }
    // If in Ask mode and backspace at empty input, return to Feedback
    if (composeMode === "ask" && isBackspace(inp, key) && input.length === 0) {
      dispatch({ type: "SET_COMPOSE_MODE", mode: "feedback" });
      dispatch({ type: "SET_CONFIRM_DISCARD", value: false });
      return;
    }

    // Compose capture rules: when there's text, ignore nav keys except Esc/Enter flow
    const hasDraft = input.trim().length > 0;
    if (hasDraft) {
      // Handle discard confirmation
      if (key.escape) {
        if (!confirmDiscard) {
          dispatch({ type: "SET_CONFIRM_DISCARD", value: true });
        } else {
          // confirmed discard
          dispatch({ type: "CLEAR_DRAFT" });
          dispatch({ type: "SET_CONFIRM_DISCARD", value: false });
        }
        return;
      }
      if (key.return) {
        // keep draft; cancel discard prompt if showing
        if (confirmDiscard) dispatch({ type: "SET_CONFIRM_DISCARD", value: false });
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
      dispatch({ type: "SET_ASK_ANSWER", value: null });
      dispatch({ type: "SET_NOTICE", value: null });
      await advanceOrLoadMore();
      return;
    } else if (key.leftArrow || (key.tab && key.shift)) {
      // Previous item (viewer)
      dispatch({ type: "SET_ASK_ANSWER", value: null });
      dispatch({ type: "SET_NOTICE", value: null });
      if (index > 0) setIndex(index - 1);
    } else if (key.downArrow || ch === "j") {
      // Scroll bottom details pane
      dispatch({ type: "SET_BOTTOM_OFFSET", value: ui.bottomOffset + 1 });
      return;
    } else if (key.upArrow || ch === "k") {
      dispatch({ type: "SET_BOTTOM_OFFSET", value: Math.max(0, ui.bottomOffset - 1) });
      return;
    } else if (key.pageDown) {
      const step = Math.max(3, Math.floor((rows ?? 24) / 4));
      dispatch({ type: "SET_BOTTOM_OFFSET", value: ui.bottomOffset + step });
      return;
    } else if (key.pageUp) {
      const step = Math.max(3, Math.floor((rows ?? 24) / 4));
      dispatch({ type: "SET_BOTTOM_OFFSET", value: Math.max(0, ui.bottomOffset - step) });
      return;
    } else if (ch === "g") {
      dispatch({ type: "SET_BOTTOM_OFFSET", value: 0 });
      return;
    } else if (ch === "?" || inp === "?") {
      dispatch({ type: "SET_COMPOSE_MODE", mode: "ask" });
      justSwitchedToAskRef.current = true;
      dispatch({ type: "CLEAR_DRAFT" });
    } else if ((ch === "v" || ch === "V") && askAnswer) {
      // Toggle ask answer visibility; cancel any pending auto-hide
      dispatch({ type: "TOGGLE_ASK_VISIBLE" });
      // Swallow the literal 'v'/'V' that TextInput may capture when empty
      justToggledVRef.current = true;
      return;
    } else if (ch === "s" || ch === "S") {
      dispatch({ type: "TOGGLE_SUMMARIES" });
      dispatch({ type: "SET_NOTICE", value: showSummaries ? "Showing full descriptions" : "Showing summaries" });
      // Swallow a stray 's' that TextInput may capture when empty
      justToggledSRef.current = true;
      return;
    }
  });

  const clearNoticeSoon = () => {
    setTimeout(() => dispatch({ type: "SET_NOTICE", value: null }), 1500);
  };

  const onSubmitAsk = async (text?: string) => {
    if (!current) return;
    const q = (text ?? input).trim();
    if (!q) return;
    try {
      const ans = await postAsk(current.trace_id, q);
      dispatch({ type: "SET_ASK_ANSWER", value: ans.answer });
      dispatch({ type: "SET_ASK_VISIBLE", value: true });
      // Auto-hide the answer after 20s
      try {
        const timer = setTimeout(() => dispatch({ type: "SET_ASK_VISIBLE", value: false }), 20_000);
        // store timer id via closure; avoid keeping reference across rerenders
        (globalThis as any).__ask_timer && clearTimeout((globalThis as any).__ask_timer);
        (globalThis as any).__ask_timer = timer;
      } catch { /* ignore */ }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      dispatch({ type: "CLEAR_DRAFT" });
      dispatch({ type: "SET_COMPOSE_MODE", mode: "feedback" });
      dispatch({ type: "SET_CONFIRM_DISCARD", value: false });
    }
  };

  const onSubmitFeedback = async (text?: string) => {
    if (!current) return;
    const fb = (text ?? input).trim();
    if (!fb) return;
    try {
      await postFeedback(current.trace_id, fb);
      dispatch({ type: "SET_NOTICE", value: "Noted." });
      clearNoticeSoon();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      dispatch({ type: "CLEAR_DRAFT" });
      dispatch({ type: "SET_CONFIRM_DISCARD", value: false });
    }
  };

  const controls = useMemo(() => (
    <Text>
      [←] prev [→] next [Tab] next [Shift+Tab] prev  [↑/↓ PgUp/PgDn] scroll  [?]ask [q]uit{failuresOnly
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
  const askLines = askAnswer
    ? (askVisible ? (askAnswer.split("\n").length + 3) : 1)
    : 0; // stub is 1 line when hidden
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

  if (ui.viewMode === "transcript" && current) {
    return (
      <TranscriptView
        t={current}
        rows={totalRows}
        cols={colsProp}
        offset={ui.transcriptOffset}
        onOffsetChange={(n) => dispatch({ type: "SET_TRANSCRIPT_OFFSET", value: n })}
        showSummaries={showSummaries}
        notice={notice ?? undefined}
      />
    );
  }

  return (
    <Box flexDirection="column" height={totalRows} justifyContent="center">
      <Box flexDirection="column" gap={1}>
        {/* Top: full-width header */}
        <Header t={current} />

        {/* Bottom: single full-width details pane (no inline trace) */}
        <Box flexDirection="column" gap={0} flexGrow={1}>
          <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} height={paneHeight}>
            <BottomDetailsPane
              issues={current.issues ?? []}
              requirements={current.requirements ?? []}
              height={paneHeight}
              offset={ui.bottomOffset}
              onOffsetChange={(n) => dispatch({ type: "SET_BOTTOM_OFFSET", value: n })}
              showSummaries={showSummaries}
            />
          </Box>
        </Box>

        {/* Footer: pinned ask answer (Phase 1: simple card) */}
        {askAnswer && <AskAnswer askAnswer={askAnswer} visible={askVisible} />}

        {/* Controls hint */}
        {controls}

        {/* Persistent command bar */}
        <CommandBar
          cols={colsProp}
          mode={composeMode}
          value={input}
          setValue={(v) => {
            // If we just switched to ask via '?' and the input captured a stray '?', drop it
            if (justSwitchedToAskRef.current && v === "?") {
              dispatch({ type: "SET_DRAFT", value: "" });
              justSwitchedToAskRef.current = false;
              return;
            }
            justSwitchedToAskRef.current = false;
            // Drop stray tabs that may leak from TextInput when empty
            if (v === "\t") {
              dispatch({ type: "SET_DRAFT", value: "" });
            } else if (justToggledVRef.current && (v === "v" || v === "V")) {
              // Swallow a lone 'v' captured by TextInput when we toggled visibility
              dispatch({ type: "SET_DRAFT", value: "" });
              justToggledVRef.current = false;
            } else if (justToggledSRef.current && (v === "s" || v === "S")) {
              // Swallow a lone 's' captured when toggling summaries
              dispatch({ type: "SET_DRAFT", value: "" });
              justToggledSRef.current = false;
            } else {
              dispatch({ type: "SET_DRAFT", value: v });
            }
            if (confirmDiscard) dispatch({ type: "SET_CONFIRM_DISCARD", value: false });
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
