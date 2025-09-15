import { useEffect } from "react";
import { Box } from "ink";
import { useScreenSize } from "fullscreen-ink";
import ReviewApp from "./Review.tsx";

interface FullScreenAppProps {
  failuresOnly?: boolean;
}

export default function FullScreenApp(
  { failuresOnly = false }: FullScreenAppProps,
) {
  const { width, height } = useScreenSize();

  // Let fullscreen-ink's FullScreenBox control size; we just flex-grow
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box flexGrow={1} flexDirection="column">
        <ReviewApp rows={height} cols={width} failuresOnly={failuresOnly} />
      </Box>
    </Box>
  );
}
