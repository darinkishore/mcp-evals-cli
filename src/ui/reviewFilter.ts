import type { TraceBrowseItem } from "../types.ts";

export function hasFailedRequirements(item: TraceBrowseItem): number {
  const reqs = item.requirements ?? [];
  return reqs.reduce((acc, r) => acc + (r.satisfied ? 0 : 1), 0);
}

export function counts(item: TraceBrowseItem) {
  const issues = item.issues ?? [];
  let critical = 0, high = 0, medium = 0, low = 0;
  for (const i of issues) {
    if (i.severity === 'CRITICAL') critical++;
    else if (i.severity === 'HIGH') high++;
    else if (i.severity === 'MEDIUM') medium++;
    else if (i.severity === 'LOW') low++;
  }
  return { critical, high, medium, low };
}

export function tier(item: TraceBrowseItem): number {
  const failed = hasFailedRequirements(item) > 0;
  const { critical, high, medium } = counts(item);
  if (failed || critical > 0) return 0;   // Tier 0: failed req OR any critical
  if (high > 0) return 1;                 // Tier 1: any high
  if (medium > 0) return 2;               // Tier 2: any medium
  return 3;                               // Not included
}

export function matchesFailuresOnly(item: TraceBrowseItem): boolean {
  const t = tier(item);
  return t <= 2; // include Tiers 0,1,2; exclude only-low or none
}

export function compareForFailuresMode(a: TraceBrowseItem, b: TraceBrowseItem): number {
  const ta = tier(a);
  const tb = tier(b);
  if (ta !== tb) return ta - tb; // lower tier first

  const fa = hasFailedRequirements(a);
  const fb = hasFailedRequirements(b);
  const ca = counts(a);
  const cb = counts(b);

  // Tier 0 tie-breakers: failed requirements count desc, then critical count desc
  if (ta === 0) {
    if (fa !== fb) return fb - fa;
    if (ca.critical !== cb.critical) return cb.critical - ca.critical;
  }

  // Tier 1 tie-breaker: high count desc
  if (ta === 1) {
    if (ca.high !== cb.high) return cb.high - ca.high;
  }

  // Tier 2 tie-breaker: medium count desc
  if (ta === 2) {
    if (ca.medium !== cb.medium) return cb.medium - ca.medium;
  }

  // Fallback: stable order (no change)
  return 0;
}

