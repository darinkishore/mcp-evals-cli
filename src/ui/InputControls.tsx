import { Box, Text } from "npm:ink@5";
import type React from "npm:react@18";
import TextInput from "npm:ink-text-input@6";

type Mode = "idle" | "ask" | "feedback";

interface InputControlsProps {
  mode: Mode;
  input: string;
  setInput: (value: string) => void;
  onSubmitAsk: () => void;
  onSubmitFeedback: () => void;
  controls: React.ReactNode;
}

export default function InputControls({ 
  mode, 
  input, 
  setInput, 
  onSubmitAsk, 
  onSubmitFeedback, 
  controls 
}: InputControlsProps) {
  if (mode === "ask") {
    return (
      <Box>
        <Text>Ask: </Text>
        <TextInput value={input} onChange={setInput} onSubmit={onSubmitAsk} />
      </Box>
    );
  }

  if (mode === "feedback") {
    return (
      <Box>
        <Text>Feedback: </Text>
        <TextInput value={input} onChange={setInput} onSubmit={onSubmitFeedback} />
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
