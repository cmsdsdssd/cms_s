export type StoneSource = "SELF" | "PROVIDED";

export const STONE_SOURCE_OPTIONS: readonly StoneSource[] = ["SELF", "PROVIDED"];

export const isStoneSource = (value: unknown): value is StoneSource =>
  value === "SELF" || value === "PROVIDED";
