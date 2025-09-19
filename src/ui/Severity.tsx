/** @jsxImportSource npm:react@19.1.1 */
// deno-lint-ignore-file no-unused-vars
import React from "npm:react@19.1.1";
import { Text } from "npm:ink@6.3.0";

interface SeverityProps {
  level: string;
}

const styles: Record<string, { bg: string; fg: string }> = {
  CRITICAL: { bg: "red", fg: "white" },
  HIGH: { bg: "yellow", fg: "black" },
  MEDIUM: { bg: "blue", fg: "white" },
  LOW: { bg: "gray", fg: "black" },
};

export default function Severity({ level }: SeverityProps) {
  const key = (level ?? "").toUpperCase();
  const { bg, fg } = styles[key] ?? { bg: "gray", fg: "white" };
  const labelMap: Record<string, string> = {
    CRITICAL: "CRIT",
    HIGH: "HIGH",
    MEDIUM: "MED",
    LOW: "LOW",
  };
  const label = labelMap[key] ?? key.slice(0, 4);
  return (
    <Text backgroundColor={bg} color={fg} bold wrap="truncate">
      {label}
    </Text>
  );
}
