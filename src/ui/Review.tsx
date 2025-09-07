import React, { useEffect, useMemo, useState } from "npm:react@18";
import { Box, Text, useApp, useInput } from "npm:ink@5";
import type { ReviewsNextResponse } from "../types.ts";
import { getNextReview, postAsk, postFeedback, postSkip } from "../api.ts";
import { Issues, Header, TraceExcerpt, AskAnswer, InputControls } from "./index.ts";

type Mode = "idle" | "ask" | "feedback";

export default function ReviewApp() {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<ReviewsNextResponse | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [input, setInput] = useState("");
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAskAnswer(null);
    setNotice(null);
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

  return (
    <Box flexDirection="column" gap={1}>
      <Header t={current} />

      <Issues issues={current.issues ?? []} />

      <TraceExcerpt messages={current.messages} />

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

