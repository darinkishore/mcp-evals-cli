/** @jsxImportSource react */
// deno-lint-ignore-file no-unused-vars
import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

type ComposeMode = "feedback" | "ask";

interface CommandBarProps {
  cols?: number;
  mode: ComposeMode;
  value: string;
  setValue: (v: string) => void;
  onSubmitFeedback: (text: string) => void;
  onSubmitAsk: (text: string) => void;
  // UX prompts beneath the bar (e.g., Noted., errors, discard ask)
  message?: string | null;
  // When true, show the discard confirmation hint beneath the bar
  confirmDiscard?: boolean;
  focused?: boolean;
}

function line(cols?: number) {
  const n = Math.max(4, Math.min(1000, cols ?? 80));
  return "\u2500".repeat(n); // BOX DRAWINGS LIGHT HORIZONTAL
}

export default function CommandBar({
  cols,
  mode,
  value,
  setValue,
  onSubmitFeedback,
  onSubmitAsk,
  message,
  confirmDiscard = false,
  focused = false,
}: CommandBarProps) {
  const isAsk = mode === "ask";
  const label = isAsk ? "Ask:" : "Feedback:";
  // Ask: magenta; Feedback: darkish blue for clarity in most terminals
  const labelColor = isAsk ? "magenta" : "blue";

  const handleSubmit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (isAsk) onSubmitAsk(trimmed);
    else onSubmitFeedback(trimmed);
  };

  return (
    <Box flexDirection="column">
      {/* top rule */}
      <Text color={labelColor}>{line(cols)}</Text>

      {/* input row */}
      <Box>
        <Text>&gt;</Text>
        <Text color={labelColor}>{label}</Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          focus={focused}
        />
      </Box>

      {/* bottom rule */}
      <Text color={labelColor}>{line(cols)}</Text>

      {/* beneath-bar messages */}
      {confirmDiscard && (
        <Text color="yellow">
          Discard draft? Press Esc to confirm, Enter to keep.
        </Text>
      )}
      {message && !confirmDiscard && <Text color="green">{message}</Text>}
    </Box>
  );
}
