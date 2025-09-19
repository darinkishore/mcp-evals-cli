/** @jsxImportSource npm:react@19.1.1 */
// deno-lint-ignore-file no-unused-vars
import React, { type ReactNode } from "npm:react@19.1.1";
import { Box, Text } from "npm:ink@6.3.0";
import TextInput from "npm:ink-text-input@6.0.0";

type Mode = "idle" | "ask" | "feedback";

interface InputControlsProps {
  mode: Mode;
  input: string;
  setInput: (value: string) => void;
  onSubmitAsk: () => void;
  onSubmitFeedback: () => void;
  controls: ReactNode;
}

export default function InputControls({
  mode,
  input,
  setInput,
  onSubmitAsk,
  onSubmitFeedback,
  controls,
}: InputControlsProps) {
  if (mode === "ask") {
    return (
      <Box>
        <Text>Ask:</Text>
        <TextInput value={input} onChange={setInput} onSubmit={onSubmitAsk} />
      </Box>
    );
  }

  if (mode === "feedback") {
    return (
      <Box>
        <Text>Feedback:</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={onSubmitFeedback}
        />
      </Box>
    );
  }

  if (mode === "idle") {
    return (
      <Box>
        {controls}
      </Box>
    );
  }

  return null;
}
