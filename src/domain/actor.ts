export type ActorType = "human" | "agent" | "process" | "unknown";

export interface ParsedActor {
  type: ActorType;
  identifier: string;
  raw: string;
}

export function parseActor(raw: string): ParsedActor {
  if (!raw || typeof raw !== "string") {
    return { type: "unknown", identifier: "unknown", raw: String(raw) };
  }

  const clean = raw.trim();
  if (clean.startsWith("human:")) {
    return { type: "human", identifier: clean.slice(6), raw: clean };
  }
  if (clean.startsWith("process:")) {
    return { type: "process", identifier: clean.slice(8), raw: clean };
  }
  if (clean.includes("/")) {
    // E.g. "antigravity/gemini-3-pro", "opencode/gpt-5-codex"
    return { type: "agent", identifier: clean, raw: clean };
  }
  if (clean.startsWith("agent:")) {
    return { type: "agent", identifier: clean.slice(6), raw: clean };
  }

  return { type: "unknown", identifier: clean, raw: clean };
}

export function isHuman(raw: string): boolean {
  return parseActor(raw).type === "human";
}
