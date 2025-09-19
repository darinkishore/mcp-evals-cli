import { assertEquals } from "jsr:@std/assert@1.0.14";
import type { TraceBrowseItem } from "../types.ts";
import {
  compareForFailuresMode,
  counts,
  hasFailedRequirements,
  matchesFailuresOnly,
  tier,
} from "./reviewFilter.ts";

function item(partial: Partial<TraceBrowseItem>): TraceBrowseItem {
  return {
    trace_id: partial.trace_id ?? "t",
    task: partial.task ?? "",
    messages: partial.messages ?? "",
    correctness: partial.correctness ?? null,
    requirements: partial.requirements ?? [],
    issues: partial.issues ?? [],
    position: partial.position ?? 1,
    total_pending: partial.total_pending ?? 1,
  };
}

Deno.test("hasFailedRequirements counts unsatisfied reqs", () => {
  const i = item({
    requirements: [
      { requirement_summary: "A", satisfied: true, failure_summary: null },
      { requirement_summary: "B", satisfied: false, failure_summary: "B fail" },
      { requirement_summary: "C", satisfied: false, failure_summary: "C fail" },
    ],
  });
  assertEquals(hasFailedRequirements(i), 2);
});

Deno.test("counts severity correctly", () => {
  const i = item({
    issues: [
      { severity: "CRITICAL", description: "x" },
      { severity: "HIGH", description: "y" },
      { severity: "HIGH", description: "z" },
      { severity: "MEDIUM", description: "m" },
      { severity: "LOW", description: "l" },
    ],
  });
  assertEquals(counts(i), { critical: 1, high: 2, medium: 1, low: 1 });
});

Deno.test("tier groups failures and critical together", () => {
  const failed = item({
    requirements: [{
      requirement_summary: "A",
      satisfied: false,
      failure_summary: "x",
    }],
  });
  const critical = item({
    issues: [{ severity: "CRITICAL", description: "x" }],
  });
  const high = item({ issues: [{ severity: "HIGH", description: "x" }] });
  const medium = item({ issues: [{ severity: "MEDIUM", description: "x" }] });
  const low = item({ issues: [{ severity: "LOW", description: "x" }] });
  assertEquals(tier(failed), 0);
  assertEquals(tier(critical), 0);
  assertEquals(tier(high), 1);
  assertEquals(tier(medium), 2);
  assertEquals(tier(low), 3);
});

Deno.test("matchesFailuresOnly excludes low-only", () => {
  const low = item({ issues: [{ severity: "LOW", description: "x" }] });
  const none = item({});
  const med = item({ issues: [{ severity: "MEDIUM", description: "x" }] });
  assertEquals(matchesFailuresOnly(low), false);
  assertEquals(matchesFailuresOnly(none), false);
  assertEquals(matchesFailuresOnly(med), true);
});

Deno.test("compareForFailuresMode sorts Tier 0 by failed reqs then criticals", () => {
  const a = item({
    requirements: [
      { requirement_summary: "A", satisfied: false, failure_summary: "" },
    ],
    issues: [{ severity: "CRITICAL", description: "x" }],
  });
  const b = item({
    requirements: [
      { requirement_summary: "A", satisfied: false, failure_summary: "" },
      { requirement_summary: "B", satisfied: false, failure_summary: "" },
    ],
    issues: [],
  });
  // b should come before a (more failed reqs)
  const arr = [a, b];
  arr.sort(compareForFailuresMode);
  assertEquals(arr[0], b);
});
