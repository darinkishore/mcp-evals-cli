import React from "npm:react@19";
import { Box, Text } from "npm:ink@6";
import { icons } from "./theme.ts";

interface TraceExcerptProps {
  messages: string;
  boxed?: boolean;
  height?: number; // visible content height (approx), including title; undefined = full
}

export default function TraceExcerpt({ messages, boxed = true, height }: TraceExcerptProps) {
  const allLines = messages.split("\n");
  let visible = allLines;
  if (typeof height === "number" && height > 0) {
    const contentLines = Math.max(0, height - 1); // leave one line for title
    visible = allLines.slice(0, contentLines);
  }

  const content = (
    <>
      <Text>{icons.trace}</Text>
      {visible.map((l: string) => (
        <Text>{l}</Text>
      ))}
    </>
  );

  if (!boxed) {
    return (
      <Box flexDirection="column">
        {content}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      {content}
    </Box>
  );
}
