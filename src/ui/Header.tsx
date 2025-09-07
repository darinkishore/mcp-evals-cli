import { Box, Text } from "npm:ink@5";
import type { ReviewsNextResponse } from "../types.ts";

interface HeaderProps {
  t: ReviewsNextResponse;
}

export default function Header({ t }: HeaderProps) {
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
