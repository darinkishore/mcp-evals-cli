/** @jsxImportSource npm:react@19.1.1 */
// deno-lint-ignore-file no-unused-vars
import React, { type ReactNode, useEffect } from "npm:react@19.1.1";
import { Box, Text, useStdin } from "npm:ink@6.3.0";
import process from "node:process";
import type {
  ReviewIssue,
  ReviewRequirement,
  TraceBrowseItem,
} from "../types.ts";
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

function* linesFromTrace(
  messages: string,
  _folded: boolean,
): Generator<ReactNode> {
  const all = messages.split("\n");
  yield <Text>{icons.trace}</Text>;
  for (const [i, line] of all.entries()) {
    const trimmed = line.trim();
    // Do not alter message bodies; backend already formats for terminal
    // Timestamp dim
    const tsMatch = trimmed.match(/^\[\d{4}-\d{2}-\d{2}[^\]]*\]\s*(.*)$/);
    if (tsMatch) {
      const rest = tsMatch[1] ?? "";
      yield (
        <Text key={`ts-${i}`}>
          <Text color="gray">
            {trimmed.slice(0, trimmed.length - rest.length)}
          </Text>
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
          {rest ? <Text>{rest}</Text> : null}
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

function* linesFromCorrectness(
  reqs: ReviewRequirement[],
  folded: boolean,
): Generator<ReactNode> {
  if (!reqs || reqs.length === 0) return;
  yield <Text>Requirements</Text>;
  const satisfied = reqs.filter((r) => r.satisfied).length;
  yield (
    <Text color={satisfied === reqs.length ? "green" : "red"}>
      {satisfied}/{reqs.length} satisfied
    </Text>
  );
  const items = folded ? reqs.filter((r) => !r.satisfied) : reqs;
  for (const [i, r] of items.entries()) {
    const ok = r.satisfied;
    yield (
      <Text key={`req-${i}`}>
        <Text color={ok ? "green" : "red"}>
          {ok ? icons.reqOk : icons.reqBad}
        </Text>{" "}
        <Text color={ok ? "green" : "red"}>{r.requirement_summary}</Text>
        {!ok && r.failure_summary ? <Text>({r.failure_summary})</Text> : null}
      </Text>
    );
  }
}

function severityWeight(s: string) {
  const order: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  return order[(s ?? "").toUpperCase()] ?? 99;
}

function* linesFromIssues(
  issues: ReviewIssue[],
  folded: boolean,
): Generator<ReactNode> {
  yield <Text>Tool Issues</Text>;
  if (!issues || issues.length === 0) {
    yield <Text color="gray">None</Text>;
    return;
  }
  const sorted = issues.slice().sort((a, b) => {
    const aw = severityWeight(a.severity);
    const bw = severityWeight(b.severity);
    if (aw !== bw) return aw - bw;
    return (a.summary || a.description || "").localeCompare(
      b.summary || b.description || "",
    );
  });
  for (const [i, it] of sorted.entries()) {
    const sev = (it.severity ?? "").toUpperCase();
    const color = sev === "CRITICAL"
      ? "red"
      : sev === "HIGH"
      ? "yellow"
      : sev === "MEDIUM"
      ? "blue"
      : "gray";
    const labelMap: Record<string, string> = {
      CRITICAL: "CRIT",
      HIGH: "HIGH",
      MEDIUM: "MED",
      LOW: "LOW",
    };
    const label = labelMap[sev] ?? sev.slice(0, 4);
    const body = folded ? (it.summary || it.description) : it.description;
    yield (
      <Text key={`iss-${i}`}>
        <Text
          backgroundColor={color}
          color={color === "yellow" ? "black" : "white"}
        >
          {label}
        </Text>{" "}
        <Text>{body}</Text>
      </Text>
    );
  }
}

export default function TranscriptView(
  { t, rows, cols, offset, onOffsetChange, showSummaries, notice }:
    TranscriptViewProps,
) {
  const folded = showSummaries; // true = summary for issues/requirements only

  // Build content lines as a flat list
  const lines: ReactNode[] = [];
  // Header is sticky and not part of scrollable content
  for (const el of linesFromTrace(t.messages, folded)) lines.push(el);
  for (const el of linesFromCorrectness(t.requirements ?? [], folded)) {
    lines.push(el);
  }
  for (const el of linesFromIssues(t.issues ?? [], folded)) lines.push(el);

  const headerRows = 3; // Trace ID + Task + optional notice line
  const hintsRows = 1; // key hints at bottom
  const visible = Math.max(1, rows - headerRows - hintsRows);
  const maxOffset = Math.max(0, lines.length - visible);
  const start = clamp(offset, 0, maxOffset);
  const end = Math.min(lines.length, start + visible);

  // Keep parent offset clamped when content/rows change
  useEffect(() => {
    if (start !== offset) onOffsetChange(start);
  }, [start, offset, onOffsetChange]);

  // Mouse wheel support (SGR 1006). Enable while mounted; cleanup on unmount
  const { stdin, setRawMode, isRawModeSupported } = useStdin();
  useEffect(() => {
    if (!stdin || !isRawModeSupported) return;
    try {
      setRawMode?.(true);
    } catch { /* ignore */ }
    // Enable SGR mouse mode
    try {
      process.stdout?.write?.("\x1b[?1000h\x1b[?1006h");
    } catch { /* ignore */ }
    const esc = String.fromCharCode(0x1b);
    const pattern = new RegExp(`${esc}\\[<(\\d+);(\\d+);(\\d+)([mM])`, "g");
    const decode = (value: unknown): string => {
      if (typeof value === "string") return value;
      if (value instanceof Uint8Array) return new TextDecoder().decode(value);
      return "";
    };
    const onData = (buf: unknown) => {
      const s = decode(buf);
      if (!s) return;
      // Parse sequences like \x1b[<64;X;Y M (wheel up) or 65 (down)
      let m: RegExpExecArray | null;
      let delta = 0;
      pattern.lastIndex = 0;
      while ((m = pattern.exec(s))) {
        const code = Number(m[1]);
        if (code === 64) delta -= 3; // wheel up
        else if (code === 65) delta += 3; // wheel down
      }
      if (delta !== 0) {
        const next = clamp(offset + delta, 0, maxOffset);
        onOffsetChange(next);
      }
    };
    stdin.on("data", onData);
    return () => {
      try {
        stdin.off?.("data", onData);
      } catch { /* ignore */ }
      try {
        process.stdout?.write?.("\x1b[?1000l\x1b[?1006l");
      } catch { /* ignore */ }
      try {
        setRawMode?.(false);
      } catch { /* ignore */ }
    };
  }, [stdin, isRawModeSupported, offset, maxOffset, onOffsetChange]);

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
          <Box key={`row-${start + i}`}>{el}</Box>
        ))}
      </Box>

      {/* Hints line */}
      <Text>
        [↑/↓/PgUp/PgDn/j/k/g/G] scroll [←/→][Tab/Shift+Tab][h/l] nav [Ctrl+T]
        exit [s] fold [q] quit
      </Text>
    </Box>
  );
}
