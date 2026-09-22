export type CognitiveEventKind =
  | "belief_change"
  | "learning"
  | "milestone"
  | "evidence"
  | "observation";

export type PersonaEventState = "draft" | "reviewed" | "accepted" | "rejected";
