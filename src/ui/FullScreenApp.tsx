import { useEffect, useState } from "react";
import { Box } from "ink";
import { useScreenSize } from "fullscreen-ink";
import process from "node:process";
import ReviewApp from "./Review.tsx";

interface FullScreenAppProps {
  failuresOnly?: boolean;
}

export default function FullScreenApp(
  { failuresOnly = false }: FullScreenAppProps,
) {
  const { width: fw, height: fh } = useScreenSize();
  const [dims, setDims] = useState({ width: fw ?? (process.stdout?.columns ?? 80), height: fh ?? (process.stdout?.rows ?? 24) });

  // Fallback resize listener for environments where useScreenSize doesn't fire (Deno/npm interop)
  useEffect(() => {
    const read = () => ({ width: process.stdout?.columns ?? 80, height: process.stdout?.rows ?? 24 });
    const onResize = () => setDims(read());
    try { process.stdout?.on?.("resize", onResize); } catch { /* ignore */ }
    // Also react to fullscreen-ink changes
    setDims({ width: fw ?? dims.width, height: fh ?? dims.height });
    return () => { try { process.stdout?.off?.("resize", onResize); } catch { /* ignore */ } };
  }, [fw, fh]);

  // Let fullscreen-ink's FullScreenBox control size; we just flex-grow
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box flexGrow={1} flexDirection="column">
        <ReviewApp rows={dims.height} cols={dims.width} failuresOnly={failuresOnly} />
      </Box>
    </Box>
  );
}
