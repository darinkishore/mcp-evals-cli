import { Box, Text } from "ink";
import type { TraceBrowseItem } from "../types.ts";
import { icons } from "./theme.ts";

interface HeaderProps {
  t: TraceBrowseItem;
}

export default function Header({ t }: HeaderProps) {
  const correctness = t.correctness === true
    ? <Text color="green">{icons.correct} correct</Text>
    : t.correctness === false
    ? <Text color="red">{icons.incorrect} incorrect</Text>
    : <Text color="yellow">{icons.unknown} unknown</Text>;

  return (
    <Box flexDirection="column" borderStyle="bold" paddingX={1}>
      <Text>
        <Text bold>Trace</Text> {t.trace_id} <Text italic>{correctness}</Text>
      </Text>
      <Text>Task: {t.task}</Text>
      <Text>Viewing [{t.position}/{t.total_pending}]</Text>
    </Box>
  );
}
