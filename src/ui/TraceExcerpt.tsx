import { Box, Text } from "npm:ink@5";

interface TraceExcerptProps {
  messages: string;
}

export default function TraceExcerpt({ messages }: TraceExcerptProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text>📜 Trace Excerpt</Text>
      {messages.split("\n").map((l: string, i: number) => (
        <Text key={i}>{l}</Text>
      ))}
    </Box>
  );
}
