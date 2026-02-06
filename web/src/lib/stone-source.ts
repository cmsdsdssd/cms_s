export type StoneSource = "SELF" | "PROVIDED" | "FACTORY";

export const STONE_SOURCE_OPTIONS: readonly StoneSource[] = ["SELF", "PROVIDED", "FACTORY"];

export const isStoneSource = (value: unknown): value is StoneSource =>
  value === "SELF" || value === "PROVIDED" || value === "FACTORY";
