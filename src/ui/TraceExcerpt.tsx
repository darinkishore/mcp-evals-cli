import { Box, Text } from "ink";
import { icons } from "./theme.ts";

interface TraceExcerptProps {
  messages: string;
  boxed?: boolean;
  height?: number; // visible content height (approx), including title; undefined = full
}

export default function TraceExcerpt(
  { messages, boxed = true, height }: TraceExcerptProps,
) {
  const allLines = messages.split("\n");
  let visible = allLines;
  if (typeof height === "number" && height > 0) {
    const contentLines = Math.max(0, height - 1); // leave one line for title
    visible = allLines.slice(0, contentLines);
  }

  function renderLine(line: string, idx: number) {
    const trimmed = line.trim();
    // Timestamp dimming: [YYYY-MM-DD HH:MM:SS] prefix
    const tsMatch = trimmed.match(/^\[\d{4}-\d{2}-\d{2}[^\]]*\]\s*(.*)$/);
    if (tsMatch) {
      const rest = tsMatch[1] ?? "";
      return (
        <Text key={idx}>
          <Text color="gray">
            {trimmed.slice(0, trimmed.length - rest.length)}
          </Text>
          <Text>{rest}</Text>
        </Text>
      );
    }

    // Label: value pattern (e.g., Action:, Observation:, User:, Assistant:, Tool:)
    const labelMatch = line.match(/^(\s*)([A-Za-z ]+):\s*(.*)$/);
    if (labelMatch) {
      const indent = labelMatch[1] ?? "";
      const rawLabel = (labelMatch[2] ?? "").trim().toUpperCase();
      const rest = labelMatch[3] ?? "";
      const colorMap: Record<string, string> = {
        USER: "cyan",
        ASSISTANT: "green",
        SYSTEM: "gray",
        TOOL: "magenta",
        ACTION: "yellow",
        OBSERVATION: "blue",
        THOUGHT: "gray",
        FINAL: "green",
        ERROR: "red",
        WARNING: "yellow",
      };
      const color = colorMap[rawLabel] ?? "white";
      return (
        <Text key={idx}>
          {indent}
          <Text color={color} bold>
            {rawLabel}:
          </Text>
          {rest ? <Text>{rest}</Text> : null}
        </Text>
      );
    }

    // JSON-ish: dim to reduce noise
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      return <Text key={idx} color="gray">{trimmed}</Text>;
    }

    // Error lines
    if (/\b(error|exception|traceback)\b/i.test(line)) {
      return <Text key={idx} color="red">{line}</Text>;
    }

    return <Text key={idx}>{line}</Text>;
  }

  const content = (
    <>
      <Text>{icons.trace}</Text>
      {visible.map((l: string, i: number) => renderLine(l, i))}
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
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
    >
      {content}
    </Box>
  );
}
