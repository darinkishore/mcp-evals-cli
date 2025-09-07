import React from "npm:react@19";
import { Text } from "npm:ink@6";

interface SeverityProps {
  level: string;
}

export default function Severity({ level }: SeverityProps) {
  const style: Record<string, string> = {
    CRITICAL: "red",
    HIGH: "yellow",
    MEDIUM: "white",
    LOW: "gray",
  };
  const color = style[level] ?? "white";
  return <Text color={color} bold>{level}</Text>;
}
