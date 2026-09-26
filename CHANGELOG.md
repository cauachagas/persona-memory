# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v0.2.0] - 2026-09-26

### Added — Spaced Repetition / Temporalidade no Conhecimento

#### Core Feature
- **Temporal review state** for knowledge documents (`heuristic`, `belief`, `competency`, `project`, `evidence`)
  - Nested `persona.review` frontmatter block with:
    - `mastery` (0–5): proficiency scale from unknown to intuitive/teaching
    - `ease_factor` (≥ 1.3): SM-2 algorithm parameter
    - `interval_days` (≥ 1): days until next review
    - `next_review` (ISO date): scheduled review date
    - `review_count`: total reviews performed
    - `last_review` (ISO datetime): timestamp of last review
    - `review_history` (max 10): ring buffer of `{at, outcome, mastery_before, mastery_after}`
- **SM-2 Simplified Algorithm** (`src/temporal.ts:computeNextReview`)
  - Outcomes: `again` (0), `hard` (1), `good` (2), `easy` (3)
  - Mastery bounds: 0–5, Ease factor clamp: ≥ 1.3, Interval minimum: 1 day
  - Automatic history truncation to 10 most recent entries

#### Mutation: `recordReviewEvent`
- Atomic review recording with cross-process file locking (`/tmp/persona-memory-<hash>.lock`)
- Updates target document frontmatter preserving all other fields
- Creates `cognitive_event` of kind `review` in `/events/` with `mastery_before`/`mastery_after`
- Updates `log.md` and `index.md` managed section
- Git stages and commits: target doc, event, log.md, index.md
- **Full rollback on failure**: restores target/index/log, removes orphaned event, clears staging area

#### Temporal Queries (`src/temporal.ts`)
- `getDueReviews(vaultRoot, date?)`: documents with `next_review <= date`
- `getSlipping(vaultRoot, thresholdDays=7)`: significantly overdue docs
- `getReviewStats(vaultRoot)`: counters — due, overdue, mastered (≥4), learning (≤2), unknown (0)
- `getMasteryHeatmap(vaultRoot)`: aggregation by type, tag, project + overall distribution

#### CLI Commands
- `persona-memory review due [--date <ISO>]` — list due reviews with mastery bar, overdue label
- `persona-memory review stats` — stats + heatmap by type/tag/project
- `persona-memory review answer <path> <again|hard|good|easy> [--summary] [--details]` — record review

#### MCP Tools (2 new)
- `get_due_reviews` — params: `include_slipping`, `max_results`, `include_stats`
- `record_review_event` — params: `target`, `outcome` (enum), `summary`, `details` (optional)

#### Validation
- Legacy docs (no `persona.review`): `WARNING` only, defaults applied on read
- Invalid fields in `persona.review`: `ERROR` (mastery>5, ease_factor<1.3, interval_days<1, invalid date format)

#### Tests
- 22 new unit tests in `test/temporal.test.ts` (parseReviewState, computeNextReview, heatmap)
- 2 new integration tests in `test/mutations.test.ts` (concurrency, rollback with pre-commit hook)
- **Total: 36 tests passing**

---

## [v0.1.0] - 2026-09-23

### Added — Initial Release
- **OKF v0.2 compliant vault** with Markdown + YAML documents
- **Document types**: `heuristic`, `belief`, `competency`, `project`, `evidence`, `cognitive_event`
- **Persona states per type**: current/superseded, active-frontier/consolidated/archived, etc.
- **Trust levels**: human-verified → source-backed → agent-generated → unverified
- **Git-backed audit trail**: every mutation commits atomically with structured messages
- **Obsidian-compatible**: wiki links, frontmatter Properties, vault structure

### MCP Tools (4 Tools)
1. `get_persona_context` — compact briefing with context budget
2. `search_memory` — weighted lexical search + 1-hop graph expansion
3. `get_memory` — full document retrieval with vault boundary enforcement
4. `record_cognitive_event` — draft events with target linking, never auto-modifies beliefs

### CLI Commands
- `persona-memory doctor` — environment diagnostics
- `persona-memory validate` — OKF v0.2 + Persona profile validation
- `persona-memory search` — context-budgeted search
- `persona-memory index` — regenerate managed index.md section
- `persona-memory serve` — MCP stdio server
- `persona-memory init` — initialize new vault

### Architecture
- 3-layer: AI Harnesses (Antigravity, OpenCode, Claude) → persona-memory engine → Persona Vault
- Cross-process file locking for safe concurrent access
- Atomic file writes with fsync + rename
- Vault jail: path traversal prevention with symlink resolution

### Tests
- Unit tests: parser, search, graph, temporal
- Integration tests: mutations (cognitive events, VAULT_DIRTY, concurrency, rollback)
- MCP tests: context briefing, search/read end-to-end
- Trajectory test: baseline → event → human review → cross-harness discovery