import process from "node:process";
import { useEffect, useState } from "npm:react@19.1.1";
import { Box } from "npm:ink@6.3.0";
import ReviewApp from "./Review.tsx";

interface FullScreenAppProps {
  failuresOnly?: boolean;
}

function getDims() {
  const cols = process.stdout?.columns ?? 80;
  const rows = process.stdout?.rows ?? 24;
  return { cols, rows };
}

export default function FullScreenApp(
  { failuresOnly = false }: FullScreenAppProps,
) {
  const [dims, setDims] = useState(getDims());

  useEffect(() => {
    const onResize = () => setDims(getDims());
    if (process.stdout?.on) {
      process.stdout.on("resize", onResize);
      return () => {
        process.stdout?.off?.("resize", onResize);
      };
    }
    return () => {};
  }, []);

  // Outer Box sized to full terminal; expand to full width by default
  return (
    <Box width={dims.cols} height={dims.rows} flexDirection="column">
      <Box width={dims.cols} flexGrow={1} flexDirection="column">
        <ReviewApp
          rows={dims.rows}
          cols={dims.cols}
          failuresOnly={failuresOnly}
        />
      </Box>
    </Box>
  );
}
