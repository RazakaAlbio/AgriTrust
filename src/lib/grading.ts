// =============================================================================
// grading.ts
// Agri-Trust — Central AI class → grade mapping (source of truth)
// All pages must import from here, never define grades inline.
// =============================================================================

export type AIClass =
  | "ripe"
  | "half_ripe"
  | "unripe"
  | "blossom_end_rot"
  | "fruit_cracking"
  | "mold"
  | "rotten";

export type Grade = "Grade A" | "Grade B" | "Grade C" | "Reject";

export interface GradeInfo {
  grade: Grade;
  label: string;         // human-readable class label
  badgeClass: string;    // tailwind classes for badge background
  textClass: string;     // tailwind classes for text color
  borderClass: string;   // tailwind classes for border color
  critical: boolean;     // true = food-safety critical (mold / rotten)
  emoji: string;
}

export const GRADE_MAP: Record<AIClass, GradeInfo> = {
  ripe: {
    grade: "Grade A",
    label: "Ripe",
    badgeClass: "bg-green-500/20 border-green-500",
    textClass: "text-green-400",
    borderClass: "border-green-500",
    critical: false,
    emoji: "✅",
  },
  half_ripe: {
    grade: "Grade B",
    label: "Half Ripe",
    badgeClass: "bg-yellow-500/20 border-yellow-500",
    textClass: "text-yellow-400",
    borderClass: "border-yellow-500",
    critical: false,
    emoji: "🟡",
  },
  unripe: {
    grade: "Grade C",
    label: "Unripe",
    badgeClass: "bg-orange-500/20 border-orange-500",
    textClass: "text-orange-400",
    borderClass: "border-orange-500",
    critical: false,
    emoji: "🟠",
  },
  blossom_end_rot: {
    grade: "Reject",
    label: "Blossom End Rot",
    badgeClass: "bg-red-500/20 border-red-500",
    textClass: "text-red-400",
    borderClass: "border-red-500",
    critical: false,
    emoji: "🔴",
  },
  fruit_cracking: {
    grade: "Reject",
    label: "Fruit Cracking",
    badgeClass: "bg-red-500/20 border-red-500",
    textClass: "text-red-400",
    borderClass: "border-red-500",
    critical: false,
    emoji: "🔴",
  },
  mold: {
    grade: "Reject",
    label: "Mold",
    badgeClass: "bg-red-700/30 border-red-700",
    textClass: "text-red-500",
    borderClass: "border-red-700",
    critical: true,
    emoji: "⚠️",
  },
  rotten: {
    grade: "Reject",
    label: "Rotten",
    badgeClass: "bg-red-700/30 border-red-700",
    textClass: "text-red-500",
    borderClass: "border-red-700",
    critical: true,
    emoji: "⚠️",
  },
};

/** Returns grade info for a class, with a safe fallback for unknown classes. */
export function getGradeInfo(cls: string): GradeInfo {
  return (
    GRADE_MAP[cls as AIClass] ?? {
      grade: "Reject",
      label: cls,
      badgeClass: "bg-gray-500/20 border-gray-500",
      textClass: "text-gray-400",
      borderClass: "border-gray-500",
      critical: false,
      emoji: "❓",
    }
  );
}

/** Given an array of detections, return the worst overall grade. */
export function worstGrade(detections: { aiClass: AIClass }[]): Grade {
  const priority: Grade[] = ["Reject", "Grade C", "Grade B", "Grade A"];
  const grades = detections.map((d) => GRADE_MAP[d.aiClass]?.grade ?? "Reject");
  for (const p of priority) {
    if (grades.includes(p)) return p;
  }
  return "Grade A";
}

/** Whether the overall batch should be rejected (any reject class present). */
export function isRejected(grade: Grade): boolean {
  return grade === "Reject";
}

/** Polygon Amoy explorer base URL */
export const AMOY_EXPLORER = "https://amoy.polygonscan.com";

/** Build a tx explorer URL. If txHash is empty, returns the explorer homepage. */
export function buildTxUrl(txHash?: string): string {
  if (!txHash) return AMOY_EXPLORER;
  return `${AMOY_EXPLORER}/tx/${txHash}`;
}
