import { OKFDocument, ReviewState, ReviewOutcome } from "./parser.js";
import { loadAllDocuments } from "./vault.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// ─── SM-2 Outcome Quality Mapping ─────────────────────────────────────────────

const OUTCOME_QUALITY: Record<ReviewOutcome, number> = {
  again: 0,
  hard: 1,
  good: 2,
  easy: 3,
};

// ─── Core Algorithm ───────────────────────────────────────────────────────────

/**
 * Computes the next review state using a simplified SM-2 algorithm.
 *
 * outcome → quality mapping:
 *   again (0) → reset interval to 1 day, ease_factor decays, mastery -1
 *   hard  (1) → interval * 1.2, ease_factor decays slightly, mastery unchanged
 *   good  (2) → interval * ease_factor, ease_factor stable, mastery +1
 *   easy  (3) → interval * ease_factor, ease_factor grows, mastery +2
 *
 * ease_factor is always clamped to ≥ 1.3 (SM-2 minimum).
 */
export function computeNextReview(
  state: ReviewState,
  outcome: ReviewOutcome,
  now: Date = new Date()
): ReviewState {
  const q = OUTCOME_QUALITY[outcome];

  // SM-2 ease factor update
  const ef = parseFloat(
    Math.max(
      1.3,
      state.ease_factor + (0.1 - (3 - q) * (0.08 + (3 - q) * 0.02))
    ).toFixed(2)
  );

  // SM-2 interval update
  const newInterval =
    q === 0
      ? 1                                         // again → restart
      : q === 1
        ? Math.max(1, Math.round(state.interval_days * 1.2))  // hard → +20%
        : Math.max(1, Math.round(state.interval_days * ef));   // good/easy → SM-2

  // Mastery delta
  const masteryDelta = q === 0 ? -1 : q === 1 ? 0 : q === 2 ? 1 : 2;
  const mastery = Math.min(5, Math.max(0, state.mastery + masteryDelta));

  const nowISO = now.toISOString();

  const newHistoryEntry = {
    at: nowISO,
    outcome,
    mastery_before: state.mastery,
    mastery_after: mastery,
  };

  return {
    mastery,
    ease_factor: ef,
    interval_days: newInterval,
    next_review: addDays(now, newInterval),
    review_count: state.review_count + 1,
    last_review: nowISO,
    // Keep the most recent 10 entries (ring buffer)
    review_history: [...state.review_history.slice(-9), newHistoryEntry],
  };
}

// ─── Temporal Queries ─────────────────────────────────────────────────────────

export interface DueReviewResult {
  path: string;
  type: string;
  title: string;
  description: string;
  review: ReviewState;
  /** Days overdue (negative = still in future, 0 = due today) */
  days_overdue: number;
}

/**
 * Returns documents whose `review.next_review` date is on or before `asOf`
 * (default: today), sorted most overdue first.
 */
export function getDueReviews(
  vaultRoot: string,
  asOf?: Date
): DueReviewResult[] {
  const cutoff = (asOf ?? new Date()).toISOString().slice(0, 10);
  const docs = loadAllDocuments(vaultRoot);

  const due: DueReviewResult[] = [];
  for (const doc of docs) {
    if (!doc.review) continue;
    if (doc.review.next_review <= cutoff) {
      const reviewDate = new Date(doc.review.next_review + "T00:00:00Z");
      const asOfDate = asOf ?? new Date();
      const days_overdue = Math.floor(
        (asOfDate.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      due.push({
        path: doc.path,
        type: doc.type,
        title: doc.title,
        description: doc.description,
        review: doc.review,
        days_overdue,
      });
    }
  }

  // Most overdue first, then by mastery ascending (weakest first)
  return due.sort((a, b) =>
    b.days_overdue - a.days_overdue || a.review.mastery - b.review.mastery
  );
}

/**
 * Returns documents that are significantly overdue (past the threshold),
 * indicating potential knowledge decay. Useful for highlighting urgency.
 */
export function getSlippingDocs(
  vaultRoot: string,
  thresholdDays = 7
): DueReviewResult[] {
  const all = getDueReviews(vaultRoot);
  return all.filter((r) => r.days_overdue >= thresholdDays);
}

// ─── Stats & Heatmap ──────────────────────────────────────────────────────────

export interface ReviewStats {
  total: number;
  /** Docs with review.next_review <= today */
  due: number;
  /** Docs with review.next_review < (today - 7 days) */
  overdue: number;
  /** Docs with mastery >= 4 */
  mastered: number;
  /** Docs with mastery <= 2 */
  learning: number;
  /** Docs with mastery === 0 (never reviewed) */
  unknown: number;
}

export function getReviewStats(vaultRoot: string): ReviewStats {
  const docs = loadAllDocuments(vaultRoot).filter((d) => d.review);
  const today = todayDateString();
  const sevenDaysAgo = addDays(new Date(), -7);

  let due = 0, overdue = 0, mastered = 0, learning = 0, unknown = 0;
  for (const doc of docs) {
    const r = doc.review!;
    if (r.next_review <= today) due++;
    if (r.next_review < sevenDaysAgo) overdue++;
    if (r.mastery >= 4) mastered++;
    if (r.mastery <= 2) learning++;
    if (r.mastery === 0) unknown++;
  }

  return { total: docs.length, due, overdue, mastered, learning, unknown };
}

export interface MasteryDistribution {
  [masteryLevel: number]: number; // 0–5 → count
}

export interface MasteryHeatmap {
  byType: Record<string, MasteryDistribution>;
  byTag: Record<string, MasteryDistribution>;
  byProject: Record<string, MasteryDistribution>;
  overall: MasteryDistribution;
}

/**
 * Aggregates mastery levels across document types, tags, and projects.
 * Useful for seeing which topic areas are consolidated vs. still learning.
 */
export function getMasteryHeatmap(vaultRoot: string): MasteryHeatmap {
  const docs = loadAllDocuments(vaultRoot).filter((d) => d.review);

  const byType: Record<string, MasteryDistribution> = {};
  const byTag: Record<string, MasteryDistribution> = {};
  const byProject: Record<string, MasteryDistribution> = {};
  const overall: MasteryDistribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  const inc = (dist: MasteryDistribution, level: number) => {
    dist[level] = (dist[level] ?? 0) + 1;
  };

  for (const doc of docs) {
    const m = doc.review!.mastery;

    // Overall
    inc(overall, m);

    // By document type
    if (!byType[doc.type]) byType[doc.type] = {};
    inc(byType[doc.type], m);

    // By tag
    for (const tag of doc.tags) {
      if (!byTag[tag]) byTag[tag] = {};
      inc(byTag[tag], m);
    }

    // By project (from frontmatter.project or project documents)
    const project =
      (typeof doc.frontmatter.project === "string" && doc.frontmatter.project.trim()) ||
      (doc.type === "project" ? doc.title : undefined);
    if (project) {
      if (!byProject[project]) byProject[project] = {};
      inc(byProject[project], m);
    }
  }

  return { byType, byTag, byProject, overall };
}

// ─── Frontmatter Serialisation Helper ─────────────────────────────────────────

/**
 * Serialises a ReviewState back into the `persona.review` YAML object shape
 * suitable for embedding in frontmatter via gray-matter's stringify.
 */
export function reviewStateToFrontmatter(state: ReviewState): Record<string, any> {
  return {
    mastery: state.mastery,
    ease_factor: state.ease_factor,
    interval_days: state.interval_days,
    next_review: state.next_review,
    review_count: state.review_count,
    last_review: state.last_review ?? null,
    review_history: state.review_history,
  };
}
