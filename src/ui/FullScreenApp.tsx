import React, { useEffect, useMemo, useState } from "npm:react@19";
import { Box } from "npm:ink@6";
import ReviewApp from "./Review.tsx";

interface FullScreenAppProps {
  failuresOnly?: boolean;
}

function getDims() {
  const proc = (globalThis as any).process;
  const cols = proc?.stdout?.columns ?? 80;
  const rows = proc?.stdout?.rows ?? 24;
  return { cols, rows };
}

export default function FullScreenApp({ failuresOnly = false }: FullScreenAppProps) {
  const [dims, setDims] = useState(getDims());

  useEffect(() => {
    const proc = (globalThis as any).process;
    const onResize = () => setDims(getDims());
    if (proc?.stdout?.on) {
      proc.stdout.on("resize", onResize);
      return () => {
        if (proc?.stdout?.off) proc.stdout.off("resize", onResize);
      };
    }
    return () => {};
  }, []);

  // Outer Box sized to full terminal; expand to full width by default
  return (
    <Box width={dims.cols} height={dims.rows} flexDirection="column">
      <Box width={dims.cols} flexGrow={1} flexDirection="column">
        <ReviewApp rows={dims.rows} cols={dims.cols} failuresOnly={failuresOnly} />
      </Box>
    </Box>
  );
}
