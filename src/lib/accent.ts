export type Accent = "a" | "b" | "c" | "amber" | "rose";

/** The colour a category's accent name stands for. */
export const accentVar = (accent: Accent) =>
  accent === "amber"
    ? "var(--amber)"
    : accent === "rose"
      ? "var(--rose)"
      : accent === "b"
        ? "var(--aurora-b)"
        : accent === "c"
          ? "var(--aurora-c)"
          : "var(--aurora-a)";
