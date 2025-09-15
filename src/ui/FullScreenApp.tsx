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

  // Outer Box sized to full terminal; expand to full width by default
  return (
    <Box width={width} height={height} flexDirection="column">
      <Box width={width} flexGrow={1} flexDirection="column">
        <ReviewApp
          rows={height}
          cols={width}
          failuresOnly={failuresOnly}
        />
      </Box>
    </Box>
  );
}
