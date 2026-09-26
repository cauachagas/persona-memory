import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  computeNextReview,
  getDueReviews,
  getReviewStats,
  getMasteryHeatmap,
} from "../src/temporal.js";
import { parseReviewState } from "../src/parser.js";
import type { ReviewState } from "../src/parser.js";

// ─── Helper ────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<ReviewState> = {}): ReviewState {
  return {
    mastery: 2,
    ease_factor: 2.5,
    interval_days: 3,
    next_review: "2026-09-01",
    review_count: 2,
    last_review: "2026-08-29T10:00:00.000Z",
    review_history: [],
    ...overrides,
  };
}

// ─── parseReviewState ────────────────────────────────────────────────────────

test("parseReviewState: applies defaults when called with undefined", () => {
  const state = parseReviewState(undefined);
  assert.equal(state.mastery, 0);
  assert.equal(state.ease_factor, 2.5);
  assert.equal(state.interval_days, 1);
  assert.equal(state.review_count, 0);
  assert.equal(state.last_review, null);
  assert.deepEqual(state.review_history, []);
});

test("parseReviewState: clamps mastery to [0,5]", () => {
  const low = parseReviewState({ mastery: -3, ease_factor: 2.5, interval_days: 1 });
  const high = parseReviewState({ mastery: 99, ease_factor: 2.5, interval_days: 1 });
  assert.equal(low.mastery, 0);
  assert.equal(high.mastery, 5);
});

test("parseReviewState: clamps ease_factor to ≥ 1.3", () => {
  const state = parseReviewState({ mastery: 1, ease_factor: 0.5, interval_days: 1 });
  assert.equal(state.ease_factor, 1.3);
});

test("parseReviewState: keeps only last 10 history entries", () => {
  const history = Array.from({ length: 15 }, (_, i) => ({
    at: "2026-01-0" + (i % 9 + 1) + "T00:00:00.000Z",
    outcome: "good" as const,
    mastery_before: 2,
    mastery_after: 3,
  }));
  const state = parseReviewState({ mastery: 2, ease_factor: 2.5, interval_days: 1, review_history: history });
  assert.equal(state.review_history.length, 10);
});

test("parseReviewState: silently drops history entries with invalid outcome", () => {
  const history = [
    { at: "2026-01-01T00:00:00.000Z", outcome: "good", mastery_before: 2, mastery_after: 3 },
    { at: "2026-01-02T00:00:00.000Z", outcome: "invalid_value", mastery_before: 1, mastery_after: 1 },
  ];
  const state = parseReviewState({ mastery: 2, ease_factor: 2.5, interval_days: 1, review_history: history });
  assert.equal(state.review_history.length, 1);
  assert.equal(state.review_history[0].outcome, "good");
});

// ─── computeNextReview — outcome: again ──────────────────────────────────────

test("computeNextReview again: resets interval to 1 day", () => {
  const next = computeNextReview(makeState({ interval_days: 10 }), "again");
  assert.equal(next.interval_days, 1);
});

test("computeNextReview again: decrements mastery by 1", () => {
  const next = computeNextReview(makeState({ mastery: 3 }), "again");
  assert.equal(next.mastery, 2);
});

test("computeNextReview again: mastery does not go below 0", () => {
  const next = computeNextReview(makeState({ mastery: 0 }), "again");
  assert.equal(next.mastery, 0);
});

test("computeNextReview again: ease_factor decays but stays ≥ 1.3", () => {
  const next = computeNextReview(makeState({ ease_factor: 1.3 }), "again");
  assert.ok(next.ease_factor >= 1.3, "ease_factor must stay ≥ 1.3, got " + next.ease_factor);
});

// ─── computeNextReview — outcome: hard ───────────────────────────────────────

test("computeNextReview hard: interval increases by ~20%", () => {
  const state = makeState({ interval_days: 10 });
  const next = computeNextReview(state, "hard");
  assert.equal(next.interval_days, 12); // Math.round(10 * 1.2) = 12
});

test("computeNextReview hard: mastery unchanged", () => {
  const next = computeNextReview(makeState({ mastery: 3 }), "hard");
  assert.equal(next.mastery, 3);
});

// ─── computeNextReview — outcome: good ───────────────────────────────────────

test("computeNextReview good: interval grows by ease_factor", () => {
  const state = makeState({ interval_days: 4, ease_factor: 2.5 });
  const next = computeNextReview(state, "good");
  assert.equal(next.interval_days, Math.max(1, Math.round(4 * 2.5)));
});

test("computeNextReview good: mastery increments by 1", () => {
  const next = computeNextReview(makeState({ mastery: 2 }), "good");
  assert.equal(next.mastery, 3);
});

test("computeNextReview good: mastery does not exceed 5", () => {
  const next = computeNextReview(makeState({ mastery: 5 }), "good");
  assert.equal(next.mastery, 5);
});

// ─── computeNextReview — outcome: easy ───────────────────────────────────────

test("computeNextReview easy: mastery increments by 2", () => {
  const next = computeNextReview(makeState({ mastery: 2 }), "easy");
  assert.equal(next.mastery, 4);
});

test("computeNextReview easy: mastery capped at 5", () => {
  const next = computeNextReview(makeState({ mastery: 4 }), "easy");
  assert.equal(next.mastery, 5);
});

test("computeNextReview easy: ease_factor increases", () => {
  const state = makeState({ ease_factor: 2.5 });
  const next = computeNextReview(state, "easy");
  assert.ok(next.ease_factor > 2.5, "ease_factor should grow on easy");
});

// ─── computeNextReview — history ring buffer ──────────────────────────────────

test("computeNextReview: appends entry to review_history", () => {
  const next = computeNextReview(makeState(), "good");
  assert.equal(next.review_history.length, 1);
  assert.equal(next.review_history[0].outcome, "good");
  assert.equal(next.review_history[0].mastery_before, 2);
  assert.equal(next.review_history[0].mastery_after, 3);
});

test("computeNextReview: keeps only 10 most recent history entries", () => {
  let state = makeState({ review_history: [] });
  for (let i = 0; i < 12; i++) {
    state = computeNextReview(state, "good");
  }
  assert.equal(state.review_history.length, 10);
});

test("computeNextReview: increments review_count", () => {
  const state = makeState({ review_count: 5 });
  const next = computeNextReview(state, "good");
  assert.equal(next.review_count, 6);
});

test("computeNextReview: sets last_review to ISO datetime", () => {
  const before = Date.now();
  const next = computeNextReview(makeState(), "good");
  const after = Date.now();
  assert.ok(next.last_review !== null);
  const ts = new Date(next.last_review!).getTime();
  assert.ok(ts >= before && ts <= after, "last_review should be around now");
});

// ─── next_review date format ──────────────────────────────────────────────────

test("computeNextReview: next_review is in YYYY-MM-DD format", () => {
  const next = computeNextReview(makeState(), "good");
  assert.match(next.next_review, /^\d{4}-\d{2}-\d{2}$/);
});

// ─── getDueReviews (pure logic, no vault I/O) — tested via integration path ──
// Full vault-based tests are in mutations.test.ts; here we just smoke-test
// the stats shape by exercising the stat counters directly.

test("computeNextReview: interval_days is always at least 1", () => {
  // This exercises the Math.max(1, ...) guard for every outcome
  for (const outcome of ["again", "hard", "good", "easy"] as const) {
    const next = computeNextReview(makeState({ interval_days: 1, ease_factor: 1.3 }), outcome);
    assert.ok(next.interval_days >= 1, "interval_days must be ≥ 1 for outcome: " + outcome);
  }
});

// ─── getMasteryHeatmap ────────────────────────────────────────────────────────

test("getMasteryHeatmap: correctly aggregates byType, byTag, and byProject", () => {
  const tempVault = fs.mkdtempSync(path.join(os.tmpdir(), "persona-vault-heatmap-"));
  fs.mkdirSync(path.join(tempVault, "beliefs"), { recursive: true });
  fs.mkdirSync(path.join(tempVault, "heuristics"), { recursive: true });

  const doc1 = `---
type: belief
title: Monolith First
description: Always start with a modular monolith
project: system-design
tags:
  - architecture
  - modularity
persona:
  state: current
  review:
    mastery: 3
    ease_factor: 2.5
    interval_days: 7
    next_review: "2026-10-01"
    review_count: 2
    last_review: "2026-09-20T10:00:00Z"
    review_history: []
---
Body content.
`;

  const doc2 = `---
type: heuristic
title: Fast Failure
description: Fail early in request pipeline
tags:
  - architecture
persona:
  state: current
  review:
    mastery: 4
    ease_factor: 2.6
    interval_days: 14
    next_review: "2026-10-15"
    review_count: 5
    last_review: "2026-09-21T10:00:00Z"
    review_history: []
---
Body content.
`;

  fs.writeFileSync(path.join(tempVault, "beliefs/monolith.md"), doc1, "utf8");
  fs.writeFileSync(path.join(tempVault, "heuristics/fast-fail.md"), doc2, "utf8");

  const heatmap = getMasteryHeatmap(tempVault);

  // byType assertions
  assert.equal(heatmap.byType["belief"][3], 1);
  assert.equal(heatmap.byType["heuristic"][4], 1);

  // byTag assertions
  assert.equal(heatmap.byTag["architecture"][3], 1);
  assert.equal(heatmap.byTag["architecture"][4], 1);
  assert.equal(heatmap.byTag["modularity"][3], 1);

  // byProject assertions
  assert.equal(heatmap.byProject["system-design"][3], 1);

  // overall assertions
  assert.equal(heatmap.overall[3], 1);
  assert.equal(heatmap.overall[4], 1);
  assert.equal(heatmap.overall[0], 0);

  // Clean up
  fs.rmSync(tempVault, { recursive: true, force: true });
});
