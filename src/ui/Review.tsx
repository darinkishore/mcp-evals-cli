import React, { useEffect, useMemo, useState } from "npm:react@18";
import { Box, Text, useApp, useInput } from "npm:ink@5";
import TextInput from "npm:ink-text-input@6";
import type { ReviewsNextResponse, ReviewIssue } from "../types.ts";
import { getNextReview, postAsk, postFeedback, postSkip } from "../api.ts";

type Mode = "idle" | "ask" | "feedback";

function Severity({ level }: { level: string }) {
  const style: Record<string, string> = {
    CRITICAL: "red",
    HIGH: "yellow",
    MEDIUM: "white",
    LOW: "gray",
  };
  const color = style[level] ?? "white";
  return <Text color={color} bold>{level}</Text>;
}

function Issues({ issues }: { issues: ReviewIssue[] }) {
  if (!issues?.length) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text>🔧 Tool Issues</Text>
        <Text color="gray">No tool issues recorded</Text>
      </Box>
    );
  }
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text>🔧 Tool Issues</Text>
      {issues.map((i, idx) => (
        <Box key={idx} gap={2}>
          <Severity level={i.severity} />
          <Text>{i.description}</Text>
        </Box>
      ))}
    </Box>
  );
}

function Header({ t }: { t: ReviewsNextResponse }) {
  const correctness = t.correctness === true
    ? <Text color="green">✓ correct</Text>
    : t.correctness === false
      ? <Text color="red">❌ incorrect</Text>
      : <Text color="yellow">unknown</Text>;

  return (
    <Box flexDirection="column" borderStyle="bold" paddingX={1}>
      <Text>
        <Text bold>Trace</Text> {t.trace_id}  <Text italic>{correctness}</Text>
      </Text>
      <Text>Task: {t.task}</Text>
      <Text>[{t.position}/{t.total_pending}] in queue</Text>
    </Box>
  );
}

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

      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text>📜 Trace Excerpt</Text>
        {current.messages.split("\n").map((l: string, i: number) => (
          <Text key={i}>{l}</Text>
        ))}
      </Box>

      {askAnswer && (
        <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1}>
          <Text>Ask</Text>
          {askAnswer.split("\n").map((l: string, i: number) => <Text key={i}>{l}</Text>)}
        </Box>
      )}

      {notice && (
        <Text color="green">{notice}</Text>
      )}

      {mode === "ask" && (
        <Box>
          <Text>Ask: </Text>
          <TextInput value={input} onChange={setInput} onSubmit={onSubmitAsk} />
        </Box>
      )}

      {mode === "feedback" && (
        <Box>
          <Text>Feedback: </Text>
          <TextInput value={input} onChange={setInput} onSubmit={onSubmitFeedback} />
        </Box>
      )}

      {mode === "idle" && (
        <Box>
          {controls}
        </Box>
      )}
    </Box>
  );
}

