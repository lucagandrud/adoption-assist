# Contributing

Two people, 26 hours. This document is short on purpose.

**Read [`CLAUDE.md`](CLAUDE.md) fully before writing code.** It is the standing brief.
For terminal commands, see [`docs/git-workflow.md`](docs/git-workflow.md).

---

## The five rules that actually matter

### 1. Nothing invented
If a CA or TX requirement is not sourced from an actual state document, mark it
`"verified": false` and let the UI surface it as unverified. **Do not guess a plausible
citation.** Fabricated regulatory content is the single fastest way to lose this, and a
judge from the public sector is exactly the person who would notice.

Log every citation in [`docs/SOURCES.md`](docs/SOURCES.md) as you author it.

### 2. No real PII
All demo data is synthetic. Never accept, upload, or commit a real person's records.
`.gitignore` carries guard patterns for this — don't remove them.

### 3. No substantive assessment
The system checks completeness, consistency, validity, and sequencing. It never judges
whether a family is fit. That is a licensed social worker's clinical judgment, and if a
family is genuinely unsuitable the human process must still catch it.

### 4. No state logic in code
Nothing in `/engines` may branch on `"CA"` or `"TX"`. Thresholds, validity periods, and
tolerances live in `/ontology`. The test: adding a 51st jurisdiction should require zero
code changes.

### 5. Demo-first
At every checkpoint the app runs end-to-end on at least one synthetic family.
**Never leave it broken overnight.** Tag checkpoints that work:

```bash
git tag -a checkpoint-h10 -m "Engines 1+2 working on clean family" && git push --tags
```

---

## Marking pseudocode

Every unimplemented file opens with:

```
/* =============================================================================
 * PSEUDOCODE — NOT IMPLEMENTED
 * ...
 * ============================================================================= */
```

Delete the banner when you implement the file. Find what's left:

```bash
grep -rln "PSEUDOCODE — NOT IMPLEMENTED" --include="*.ts" .
```

**Never leave a half-implemented file carrying the banner** — a file that is partly real and
still says "not implemented" is worse than either state alone.

---

## Ownership

| Owner | Directories |
|---|---|
| Person A | `/ontology`, `/engines` |
| Person B | `/app`, `/extraction`, `/demo` |

Shared, handle deliberately:
- **`ontology/schema.ts`** — write together in hours 0–2, then freeze
- **`engines/graph.ts`** — A owns producing `GraphModel`, B owns rendering it
- **`README.md` / `CLAUDE.md`** — announce before editing, they conflict easily

---

## Commits

Prefix by area so `git log --oneline` is scannable at hour 20:

```
ontology:  engines:  extraction:  app:  demo:  docs:  chore:
```

Commit small and often. Small commits are easier to undo at 4am.

---

## Cut order

```
CUT FIRST →  D6 voice intake (fall back to text chat)
             D4 state-pair delta
             D7 caseworker surface
NEVER CUT →  D1 consistency engine, D3 dependency graph
```

**Freeze at hour 24.** Two hours of rehearsal beats one more feature.
