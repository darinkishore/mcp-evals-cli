import React, { useEffect, useMemo, useState } from "npm:react@19";
import { Box, Text, useApp, useInput } from "npm:ink@6";
import type { ReviewsNextResponse } from "../types.ts";
import { getNextReview, postAsk, postFeedback, postSkip } from "../api.ts";
import { Issues, Header, Requirements, TraceExcerpt, AskAnswer, InputControls } from "./index.ts";
import { icons } from "./theme.ts";

type Mode = "idle" | "ask" | "feedback";

interface ReviewProps {
  rows?: number;
  cols?: number;
}

export default function ReviewApp({ rows, cols }: ReviewProps) {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<ReviewsNextResponse | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [focus, setFocus] = useState<"left" | "right">("left");
  const [rightOffset, setRightOffset] = useState<number>(0);
  const [input, setInput] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAskAnswer(null);
    setNotice(null);
    setRightOffset(0);
    getNextReview()
      .then((n) => {
        if (cancelled) return;
        setCurrent(n);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message ?? String(e));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [refresh]);

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
    } else if (ch === "n") {
      setRefresh((x: number) => x + 1);
    } else if (ch === "s") {
      if (!current) return;
      try {
        await postSkip(current.trace_id);
        setNotice("Skipped");
        setRefresh((x: number) => x + 1);
      } catch (e) {
        setError((e as Error).message);
      }
    } else if (ch === "a") {
      setMode("ask");
      setInput("");
    } else if (ch === "f") {
      setMode("feedback");
      setInput("");
    } else if (ch === "h") {
      setFocus("left");
    } else if (ch === "l") {
      setFocus("right");
    } else if (ch === "j") {
      // Scroll down in focused pane (right pane scroll implemented)
      if (focus === "right") {
        setRightOffset((o: number) => o + 1);
      }
    } else if (ch === "k") {
      if (focus === "right") {
        setRightOffset((o: number) => Math.max(0, o - 1));
      }
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
      setRefresh((x: number) => x + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMode("idle");
      setInput("");
    }
  };

  const controls = useMemo(() => (
    <Text>
      [f]eedback  [s]kip  [a]sk  [n]ext  [q]uit
    </Text>
  ), []);

  if (loading) return <Text color="gray">Loading…</Text>;
  if (error) return <Text color="red">{error}</Text>;
  if (!current) return <Text color="green">✓ All traces reviewed!</Text>;

  // Approximate visible height for the right pane to enable scrolling
  const totalRows = rows ?? 24;
  const reservedBottom = 6; // space for ask/notice/controls
  const headerRows = 5;     // approx: boxed header with 3 lines + borders
  const verticalGaps = 2;   // gaps between sections
  const paneHeight = Math.max(4, totalRows - reservedBottom - headerRows - verticalGaps);

  return (
    <Box flexDirection="column" gap={1}>
      {/* Top: full-width header */}
      <Header t={current} />

      {/* Bottom: two boxes at the same height filling remaining space */}
      <Box flexDirection="row" gap={2} flexGrow={1}>
        {/* Left bottom box: Review Details */}
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} flexGrow={3} height={paneHeight}>
          <Text>{`${focus === "left" ? "» " : "  "}${icons.details}`}</Text>
          <Requirements requirements={current.requirements ?? []} />
          <Issues issues={current.issues ?? []} boxed={false} />
        </Box>

        {/* Right bottom box: Trace */}
        <Box flexDirection="column" flexGrow={2}>
          <TraceExcerpt messages={current.messages} height={paneHeight} offset={rightOffset} focused={focus === "right"} />
        </Box>
      </Box>

      {/* Footer: ask/answer, notices, and controls */}
      {askAnswer && (
        <AskAnswer askAnswer={askAnswer} />
      )}

      {notice && (
        <Text color="green">{notice}</Text>
      )}

      <InputControls 
        mode={mode}
        input={input}
        setInput={setInput}
        onSubmitAsk={onSubmitAsk}
        onSubmitFeedback={onSubmitFeedback}
        controls={controls}
      />
    </Box>
  );
}
