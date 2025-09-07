import { Box, Text } from "npm:ink@5";
import type { ReviewIssue } from "../types.ts";
import Severity from "./Severity.tsx";

interface IssuesProps {
  issues: ReviewIssue[];
}

export default function Issues({ issues }: IssuesProps) {
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
