import { Box, Text } from "ink";
import type { ReactNode } from "react";
import type { TraceBrowseItem, ReviewIssue, ReviewRequirement } from "../types.ts";
import { icons } from "./theme.ts";

interface TranscriptViewProps {
  t: TraceBrowseItem;
  rows: number;
  cols?: number;
  offset: number;
  onOffsetChange: (n: number) => void;
  showSummaries: boolean; // true = folded/summary, false = full
  notice?: string | null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function* linesFromTrace(messages: string, folded: boolean): Generator<ReactNode> {
  const all = messages.split("\n");
  yield <Text>{icons.trace}</Text>;
  for (const [i, line] of all.entries()) {
    const trimmed = line.trim();
    // Fold JSON-ish when collapsed
    if (folded && ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]")))) {
      yield <Text color="gray">[json]</Text>;
      continue;
    }
    // Timestamp dim
    const tsMatch = trimmed.match(/^\[\d{4}-\d{2}-\d{2}[^\]]*\]\s*(.*)$/);
    if (tsMatch) {
      const rest = tsMatch[1] ?? "";
      yield (
        <Text key={`ts-${i}`}>
          <Text color="gray">{trimmed.slice(0, trimmed.length - rest.length)}</Text>
          <Text>{rest}</Text>
        </Text>
      );
      continue;
    }
    const labelMatch = line.match(/^(\s*)([A-Za-z ]+):\s*(.*)$/);
    if (labelMatch) {
      const indent = labelMatch[1] ?? "";
      const rawLabel = (labelMatch[2] ?? "").trim().toUpperCase();
      const rest = labelMatch[3] ?? "";
      const colorMap: Record<string, string> = {
        USER: "cyan",
        ASSISTANT: "green",
        SYSTEM: "gray",
        TOOL: "magenta",
        ACTION: "yellow",
        OBSERVATION: "blue",
        THOUGHT: "gray",
        FINAL: "green",
        ERROR: "red",
        WARNING: "yellow",
      };
      const color = colorMap[rawLabel] ?? "white";
      yield (
        <Text key={`lbl-${i}`}>
          {indent}
          <Text color={color}>{rawLabel}:</Text>
          {rest ? <Text> {rest}</Text> : null}
        </Text>
      );
      continue;
    }
    // Error emphasis
    if (/\b(error|exception|traceback)\b/i.test(line)) {
      yield <Text key={`err-${i}`} color="red">{line}</Text>;
      continue;
    }
    yield <Text key={`ln-${i}`}>{line}</Text>;
  }
}

function* linesFromCorrectness(reqs: ReviewRequirement[], folded: boolean): Generator<ReactNode> {
  if (!reqs || reqs.length === 0) return;
  yield <Text>Requirements</Text>;
  const satisfied = reqs.filter((r) => r.satisfied).length;
  yield <Text color={satisfied === reqs.length ? "green" : "red"}>{satisfied}/{reqs.length} satisfied</Text>;
  const items = folded ? reqs.filter((r) => !r.satisfied) : reqs;
  for (const [i, r] of items.entries()) {
    const ok = r.satisfied;
    yield (
      <Text key={`req-${i}`}>
        <Text color={ok ? "green" : "red"}>{ok ? icons.reqOk : icons.reqBad}</Text>{" "}
        <Text color={ok ? "green" : "red"}>{r.requirement_summary}</Text>
        {!ok && r.failure_summary ? <Text> ({r.failure_summary})</Text> : null}
      </Text>
    );
  }
}

function severityWeight(s: string) {
  const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  return order[(s ?? "").toUpperCase()] ?? 99;
}

function* linesFromIssues(issues: ReviewIssue[], folded: boolean): Generator<ReactNode> {
  yield <Text>Tool Issues</Text>;
  if (!issues || issues.length === 0) {
    yield <Text color="gray">None</Text>;
    return;
  }
  const sorted = issues.slice().sort((a, b) => {
    const aw = severityWeight(a.severity);
    const bw = severityWeight(b.severity);
    if (aw !== bw) return aw - bw;
    return (a.summary || a.description || "").localeCompare(b.summary || b.description || "");
  });
  for (const [i, it] of sorted.entries()) {
    const sev = (it.severity ?? "").toUpperCase();
    const color = sev === "CRITICAL" ? "red" : sev === "HIGH" ? "yellow" : sev === "MEDIUM" ? "blue" : "gray";
    const labelMap: Record<string, string> = { CRITICAL: "CRIT", HIGH: "HIGH", MEDIUM: "MED", LOW: "LOW" };
    const label = labelMap[sev] ?? sev.slice(0, 4);
    const body = folded ? (it.summary || it.description) : it.description;
    yield (
      <Text key={`iss-${i}`}>
        <Text backgroundColor={color} color={color === "yellow" ? "black" : "white"}> {label} </Text>{" "}
        <Text>{body}</Text>
      </Text>
    );
  }
}

export default function TranscriptView({ t, rows, cols, offset, onOffsetChange, showSummaries, notice }: TranscriptViewProps) {
  const folded = showSummaries; // true = folded/summary

  // Build content lines as a flat list
  const lines: ReactNode[] = [];
  // Header is sticky and not part of scrollable content
  for (const el of linesFromTrace(t.messages, folded)) lines.push(el);
  for (const el of linesFromCorrectness(t.requirements ?? [], folded)) lines.push(el);
  for (const el of linesFromIssues(t.issues ?? [], folded)) lines.push(el);

  const headerRows = 3; // Trace ID + Task + optional notice line
  const hintsRows = 1; // key hints at bottom
  const visible = Math.max(1, rows - headerRows - hintsRows);
  const maxOffset = Math.max(0, lines.length - visible);
  const start = clamp(offset, 0, maxOffset);
  const end = Math.min(lines.length, start + visible);

  return (
    <Box flexDirection="column" height={rows} width={cols ?? undefined}>
      {/* Sticky header */}
      <Box flexDirection="column" borderStyle="bold" paddingX={1}>
        <Text>
          <Text>Trace</Text> {t.trace_id}
        </Text>
        <Text>Task: {t.task}</Text>
        {notice ? <Text color="yellow">{notice}</Text> : null}
      </Box>

      {/* Scrollable content window */}
      <Box flexDirection="column" height={visible}>
        {lines.slice(start, end).map((el, i) => (
          <Box key={i}>{el}</Box>
        ))}
      </Box>

      {/* Hints line */}
      <Text>
        [↑/↓/PgUp/PgDn/j/k/g/G] scroll  [←/→][Tab/Shift+Tab][h/l] nav  [Ctrl+T] exit  [s] fold  [q] quit
      </Text>
    </Box>
  );
}
