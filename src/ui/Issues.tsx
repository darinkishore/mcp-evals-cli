import React from "npm:react@19";
import { Box, Text } from "npm:ink@6";
import type { ReviewIssue } from "../types.ts";
import Severity from "./Severity.tsx";
import { icons } from "./theme.ts";

interface IssuesProps {
  issues: ReviewIssue[];
  boxed?: boolean;
}

export default function Issues({ issues, boxed = true }: IssuesProps) {
  const inner = !issues?.length ? (
    <>
      <Text>{icons.issues}</Text>
      <Text color="gray">No tool issues recorded</Text>
    </>
  ) : (
    <>
      <Text>{icons.issues}</Text>
      {issues.map((i, idx) => (
        <Box key={idx} gap={2}>
          <Severity level={i.severity} />
          <Text>{i.description}</Text>
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
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      {inner}
    </Box>
  );
}
