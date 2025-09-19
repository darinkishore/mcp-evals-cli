/** @jsxImportSource react */
// deno-lint-ignore-file no-unused-vars
import React, { type ReactNode } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

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
