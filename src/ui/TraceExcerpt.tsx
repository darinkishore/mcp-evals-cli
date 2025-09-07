import React from "npm:react@19";
import { Box, Text } from "npm:ink@6";
import { icons } from "./theme.ts";

interface TraceExcerptProps {
  messages: string;
  boxed?: boolean;
  focused?: boolean;
  height?: number; // visible content height (approx), including title; undefined = full
  offset?: number; // starting line offset for scroll
}

export default function TraceExcerpt({ messages, boxed = true, focused = false, height, offset = 0 }: TraceExcerptProps) {
  const allLines = messages.split("\n");
  let visible = allLines;
  if (typeof height === "number" && height > 0) {
    const contentLines = Math.max(0, height - 1); // leave one line for title
    const maxOffset = Math.max(0, allLines.length - contentLines);
    const start = Math.min(Math.max(0, offset), maxOffset);
    visible = allLines.slice(start, start + contentLines);
  }

  const content = (
    <>
      <Text>{`${focused ? "» " : "  "}${icons.trace}`}</Text>
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
