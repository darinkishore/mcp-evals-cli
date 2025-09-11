import React from "npm:react@19";
import { Box, Text } from "npm:ink@6";
import type { ReviewIssue } from "../types.ts";
import Severity from "./Severity.tsx";
import { icons } from "./theme.ts";

interface IssuesProps {
  issues: ReviewIssue[];
  boxed?: boolean;
  showSummaries?: boolean;
}

export default function Issues({ issues, boxed = true, showSummaries = true }: IssuesProps) {
  // Sort by severity: CRITICAL -> HIGH -> MEDIUM -> LOW -> others
  const order: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  const sorted = (issues ?? []).slice().sort((a, b) => {
    const aKey = (a.severity ?? "").toUpperCase();
    const bKey = (b.severity ?? "").toUpperCase();
    const aw = order[aKey] ?? 99;
    const bw = order[bKey] ?? 99;
    if (aw !== bw) return aw - bw;
    return (a.summary || a.description || "").localeCompare(
      b.summary || b.description || "",
    );
  });

  const inner = !sorted.length
    ? (
      <>
        <Text>{icons.issues}</Text>
        <Text color="gray">No tool issues recorded</Text>
      </>
    )
    : (
      <>
        <Text>{icons.issues}</Text>
        {sorted.map((i, idx) => (
          <Box key={idx} gap={2}>
            <Severity level={i.severity} />
            <Text>{showSummaries ? (i.summary || i.description) : i.description}</Text>
          </Box>
        ))}
      </>
    );

  if (!boxed) {
    return (
      <Box flexDirection="column">
        {inner}
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
    >
      {inner}
    </Box>
  );
}
