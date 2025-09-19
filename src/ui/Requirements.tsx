import { Box, Text } from "npm:ink@6.3.0";
import type { ReviewRequirement } from "../types.ts";
import { icons } from "./theme.ts";

interface RequirementsProps {
  requirements: ReviewRequirement[];
}

export default function Requirements({ requirements }: RequirementsProps) {
  if (!requirements || requirements.length === 0) {
    return null;
  }

  const satisfied = requirements.filter((req) => req.satisfied).length;
  const total = requirements.length;

  // Create visual progress bar with colored dots
  const progressDots = requirements.map((req) => (
    <Text color={req.satisfied ? "green" : "red"}>
      {req.satisfied ? icons.reqOk : icons.reqBad}
    </Text>
  ));

  return (
    <Box flexDirection="column" marginY={1}>
      <Text>
        [
        {progressDots}
        ] {satisfied}/{total} satisfied
      </Text>

      {requirements.map((req) => (
        <Text>
          <Text color={req.satisfied ? "green" : "red"}>
            {req.satisfied ? icons.reqOk : icons.reqBad}
          </Text>{" "}
          <Text bold color={req.satisfied ? "green" : "red"}>
            {req.requirement_summary}
          </Text>
          {!req.satisfied && req.failure_summary && (
            <Text>({req.failure_summary})</Text>
          )}
        </Text>
      ))}
    </Box>
  );
}
