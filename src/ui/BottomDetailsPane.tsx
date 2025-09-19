import { Box, Text } from "npm:ink@6.3.0";
import type { ReviewIssue, ReviewRequirement } from "../types.ts";
import type { ReactNode } from "npm:react@19.1.1";
import { useEffect } from "npm:react@19.1.1";

interface BottomDetailsPaneProps {
  issues: ReviewIssue[];
  requirements: ReviewRequirement[];
  height: number; // visible rows for the pane
  offset: number; // scroll offset in rows
  onOffsetChange: (n: number) => void;
  showSummaries: boolean; // true = folded summaries
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export default function BottomDetailsPane({
  issues,
  requirements,
  height,
  offset,
  onOffsetChange,
  showSummaries,
}: BottomDetailsPaneProps) {
  const lines: ReactNode[] = [];

  // Title line (to mirror prior header)
  lines.push(<Text key="ttl">Review Details</Text>);

  // Tool Issues first
  lines.push(<Text key="iss-h">Tool Issues</Text>);
  if (!issues || issues.length === 0) {
    lines.push(
      <Text key="iss-none" color="gray">No tool issues recorded</Text>,
    );
  } else {
    const order: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    };
    const sorted = issues.slice().sort((a, b) => {
      const aw = order[(a.severity ?? "").toUpperCase()] ?? 99;
      const bw = order[(b.severity ?? "").toUpperCase()] ?? 99;
      if (aw !== bw) return aw - bw;
      return (a.summary || a.description || "").localeCompare(
        b.summary || b.description || "",
      );
    });
    for (let i = 0; i < sorted.length; i++) {
      const it = sorted[i]!;
      const sev = (it.severity ?? "").toUpperCase();
      const labelMap: Record<string, string> = {
        CRITICAL: "CRIT",
        HIGH: "HIGH",
        MEDIUM: "MED",
        LOW: "LOW",
      };
      const label = labelMap[sev] ?? sev.slice(0, 4);
      const color = sev === "CRITICAL"
        ? "red"
        : sev === "HIGH"
        ? "yellow"
        : sev === "MEDIUM"
        ? "blue"
        : "gray";
      const body = showSummaries
        ? (it.summary || it.description)
        : it.description;
      lines.push(
        <Text key={`iss-${i}`}>
          <Text
            backgroundColor={color}
            color={color === "yellow" ? "black" : "white"}
          >
            {label}
          </Text>{" "}
          <Text>{body}</Text>
        </Text>,
      );
    }
  }

  // Correctness
  if (requirements && requirements.length > 0) {
    const satisfied = requirements.filter((r) => r.satisfied).length;
    lines.push(
      <Text key="req-h">
        Requirements —{" "}
        <Text color={satisfied === requirements.length ? "green" : "red"}>
          {satisfied}/{requirements.length} satisfied
        </Text>
      </Text>,
    );
    const list = showSummaries
      ? requirements.filter((r) => !r.satisfied)
      : requirements;
    for (let i = 0; i < list.length; i++) {
      const r = list[i]!;
      const ok = r.satisfied;
      lines.push(
        <Text key={`req-${i}`}>
          <Text color={ok ? "green" : "red"}>{ok ? "●" : "○"}</Text>{" "}
          <Text color={ok ? "green" : "red"}>{r.requirement_summary}</Text>
          {!ok && r.failure_summary ? <Text>({r.failure_summary})</Text> : null}
        </Text>,
      );
    }
  }

  // Compute visible window with clamping
  const contentRows = Math.max(0, lines.length);
  const maxOffset = Math.max(0, contentRows - height);
  const start = clamp(offset, 0, maxOffset);
  const end = Math.min(lines.length, start + height);
  // Defer parent offset correction to an effect to avoid update-in-render loops
  useEffect(() => {
    if (start !== offset) onOffsetChange(start);
    // Only depend on computed start/offset; height/content changes recompute start
  }, [start, offset]);

  const overflowTop = start > 0;
  const overflowBottom = end < lines.length;
  const bottomRemaining = Math.max(0, lines.length - end);

  return (
    <Box flexDirection="column" height={height}>
      {overflowTop ? <Text color="gray">… {start} above</Text> : null}
      {lines.slice(start, end).map((el, i) => (
        <Box key={`brow-${start + i}`}>{el}</Box>
      ))}
      {overflowBottom
        ? <Text color="gray">… +{bottomRemaining} more (scroll)</Text>
        : null}
    </Box>
  );
}
