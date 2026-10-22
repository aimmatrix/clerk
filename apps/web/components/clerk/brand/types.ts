// Literal unions mirroring the shared contract (packages/core/src/types.ts).
// Kept local so the brand kit has no build-time dependency on @clerk/core;
// they are structurally identical, so core's ItemType/Priority are assignable.
export type ItemType = "request" | "task" | "event" | "question" | "decision" | "noise";
export type Priority = "P0" | "P1" | "P2" | "P3";
