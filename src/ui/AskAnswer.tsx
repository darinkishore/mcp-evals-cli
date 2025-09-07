import { Box, Text } from "npm:ink@5";

interface AskAnswerProps {
  askAnswer: string;
}

export default function AskAnswer({ askAnswer }: AskAnswerProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1}>
      <Text>Ask</Text>
      {askAnswer.split("\n").map((l: string, i: number) => <Text key={i}>{l}</Text>)}
    </Box>
  );
}
