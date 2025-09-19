/** @jsxImportSource npm:react@19.1.1 */
// deno-lint-ignore-file no-unused-vars
import React from "npm:react@19.1.1";
import { Box, Text } from "npm:ink@6.3.0";

interface AskAnswerProps {
  askAnswer: string;
  visible?: boolean;
}

export default function AskAnswer(
  { askAnswer, visible = true }: AskAnswerProps,
) {
  if (!askAnswer) return null;
  if (!visible) {
    return <Text color="gray">Answer hidden (press V to view)</Text>;
  }
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="magenta"
      paddingX={1}
    >
      <Text>Ask → Answer</Text>
      {askAnswer.split("\n").map((l: string, i: number) => (
        <Text key={i}>{l}</Text>
      ))}
    </Box>
  );
}
