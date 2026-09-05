# Handoff — Ontology & Backend (Christopher)

**You own:** `/ontology`, `/engines`
**You never touch:** `/app`, `/extraction`
**Your branch:** `christopher`

Your job is to turn CA, TX, and federal ICPC regulations into machine-readable data, then
turn that data into the JSON the dashboard renders. **You are the reason this project isn't a
checklist app.**

---

## Step 0 — Do this with Luca before anything else (30 min)

Open [`demo/fixtures/graph-model.example.json`](../demo/fixtures/graph-model.example.json)
together.

**That file is the contract.** Your engines must emit exactly that shape. Luca's dashboard
renders exactly that shape. Agree on it now, then neither of you waits for the other all
weekend.

If you need to add a field later, say it out loud, change it together, both push and pull
immediately. Changing it silently breaks Luca's UI without warning.

- [ ] Read the fixture end to end with Luca
- [ ] Agree the shape is right
- [ ] Commit any changes to `main` together

---

## Step 1 — Research and collect sources (3–4 hrs, before the event if allowed)

**This is the long pole. It cannot be compressed. Start here, not with code.**

Collect actual regulation documents. Save PDFs or URLs — you'll need to cite page and section.

Where to look:

| Source | What you want |
|---|---|
| **AAICPC** | ICPC regulations, the ICPC-100A and 100B forms, the 180-day decision rule |
| **California CDSS** | Resource Family Approval (RFA) written directives, all-county letters |
| **Texas DFPS** | Home screening and licensing standards, plus the Texas Administrative Code chapters they implement |
| **Child Welfare Information Gateway** | Orientation only — **cite the underlying state document, not the summary** |

For each requirement you find, record: what it obligates, which state, sending or receiving,
what document satisfies it, how long that document stays valid, how long it takes to obtain,
and what must happen before it.

- [ ] Sources collected for federal ICPC baseline
- [ ] Sources collected for California (RFA)
- [ ] Sources collected for Texas (DFPS)
- [ ] Every source logged in [`docs/SOURCES.md`](SOURCES.md) as you go

> **Log citations while you research, not after.** Reconstructing them later never happens,
> and an uncited requirement is worth less than no requirement.

---

## Step 2 — Author the fact type registry FIRST (1 hr)

**File:** `ontology/shared/fact-types.json`

This is the shared vocabulary. Every requirement and rule references these keys, so it has to
exist before anything else.

```json
{
  "fact.person.legal_name":     { "value_type": "string" },
  "fact.person.date_of_birth":  { "value_type": "date" },
  "fact.residence.address":     { "value_type": "address" },
  "fact.income.annual_gross":   { "value_type": "money", "unit": "USD/yr, GROSS not AGI" },
  "fact.household.size":        { "value_type": "integer" },
  "fact.home.bedroom_count":    { "value_type": "integer" }
}
```

**Write the unit convention down.** "Gross vs. AGI" and "annual vs. monthly" are not details —
comparing across them produces a false defect on every self-employed family.

- [ ] Registry authored with value types and unit conventions
- [ ] Reviewed once for anything ambiguous

---

## Step 3 — Author documents (2 hrs)

**Files:** `ontology/ca/documents/*.json`, `ontology/tx/documents/*.json`

```json
{
  "id": "doc-fingerprint-clearance",
  "type": "fingerprint_clearance",
  "states_accepted": ["CA"],
  "validity_period_days": 365,
  "external_turnaround_days": 28,
  "yields_facts": ["fact.person.legal_name", "fact.person.date_of_birth"],
  "source_citation": { "text": "...", "url": "...", "retrieved": "2026-09-05" },
  "verified": true
}
```

Two fields carry disproportionate weight:

- **`external_turnaround_days`** — how long it takes to *obtain*. Drives the critical path. A
  missing value silently makes the projected filing date wrong.
- **`validity_period_days`** — how long it stays good. Drives expiration warnings. **This is
  state-specific** — the same document can expire on a different clock in CA than in TX, and
  that difference is a real finding.

- [ ] CA documents authored
- [ ] TX documents authored
- [ ] Federal/shared documents authored

---

## Step 4 — Author requirements (3 hrs) ← the core deliverable

**Files:** `ontology/ca/requirements/*.json`, `ontology/tx/requirements/*.json`

**One file per requirement group, not one big file per state.** New files never conflict in
git; one big file conflicts constantly.

```json
{
  "id": "req-bg-clearance",
  "state": "TX",
  "direction": "receiving",
  "applies_to": ["relative", "parent", "non_relative"],
  "satisfied_by_documents": ["doc-clearance"],
  "satisfied_by_facts": [],
  "depends_on": ["req-bg-fingerprint"],
  "source_citation": { "text": "...", "url": "...", "retrieved": "2026-09-05" },
  "verified": true
}
```

**`depends_on` is the whole graph.** Luca's dashboard is generated from these edges. Never
hand-author a node list — set the edges and the graph derives itself.

### Depth over breadth

**Aim for ~15 requirements that form a real dependency chain, not 50 flat ones.**

A demo where fingerprinting blocks clearance, which blocks the home study, which blocks the
ICPC-100A filing — that shows something a checklist cannot. Fifty disconnected boxes show
nothing, no matter how many you author.

### The direction must matter

CA→TX and TX→CA have to produce visibly different graphs. That's demo beat #1. If both
directions render the same picture, the data is too thin — and no amount of UI work fixes it.

- [ ] CA sending-direction requirements
- [ ] CA receiving-direction requirements
- [ ] TX sending-direction requirements
- [ ] TX receiving-direction requirements
- [ ] Federal/shared requirements
- [ ] Dependency chain is at least 4 levels deep
- [ ] CA→TX and TX→CA visibly differ

---

## Step 5 — Author consistency rules (1.5 hrs)

**Files:** `ontology/{ca,tx,shared}/rules/*.json`

These produce the defects. Start with the one the demo depends on.

```json
{
  "id": "rule-address-consistency",
  "expression": "addresses_match",
  "facts_involved": ["fact.residence.address"],
  "severity": "blocking",
  "defect_message": "The address on {source_a} differs from the address on {source_b}. Which is current?",
  "source_citation": { "text": "...", "url": "..." }
}
```

Priority order:

1. **`addresses_match`** — this is the money shot. Build it first, make it solid.
2. `names_match` — normalize case, punctuation, middle names, suffixes. A missing middle name is **not** a conflict.
3. `income_matches_tax_return` — tolerance comes from the ontology, never hardcoded
4. `household_size_consistent`
5. `bedrooms_support_child_count`

**Write defect messages as questions, not accusations.** "Which is current?" beats "ERROR:
mismatch." A false positive tells a caseworker their real paperwork is broken, which is
exactly the burden this project exists to remove.

- [ ] `addresses_match` authored and tested
- [ ] 3+ additional rules authored

---

## Step 6 — Boot validation (1 hr)

**File:** `ontology/schema.ts` — replace the pseudocode with real Zod schemas.

Load every JSON file, parse through Zod, **throw on failure — never continue with partial
data.** Then check what Zod can't:

- [ ] Every `depends_on` id resolves to a real requirement
- [ ] Every `satisfied_by_documents` id resolves to a real document
- [ ] Every fact key resolves to the registry
- [ ] **The dependency graph is acyclic** — a cycle means the case can never start, and it must fail loudly at boot, not silently at render
- [ ] Unverified entries collected and reported so the UI can badge them

---

## Step 7 — The engines (5 hrs)

Replace the pseudocode in `/engines`. Each file already contains the algorithm, the output
shape, and the open design questions — read the file before writing code.

| File | Does | Priority |
|---|---|---|
| [`graph.ts`](../engines/graph.ts) | Resolve state pair → build DAG → critical path → **emit the contract JSON** | ⭐ first |
| [`consistency.ts`](../engines/consistency.ts) | Run rules over facts → defects naming both sources | ⭐ second |
| [`delta.ts`](../engines/delta.ts) | State-pair requirement resolution (feeds graph.ts) | needed by graph |
| [`validity.ts`](../engines/validity.ts) | Expiration math vs. the 180-day window | third |

**`graph.ts` emitting valid contract JSON is your most important milestone.** The moment it
does, Luca swaps the fixture for your real output and the app is live end to end.

- [ ] `graph.ts` emits JSON matching the fixture exactly
- [ ] Told Luca it's ready
- [ ] `consistency.ts` produces defects with both sources named
- [ ] `validity.ts` flags documents expiring before the projected decision

---

## Rules you cannot break

1. **Never invent a requirement or a citation.** No source → `verified: false`. A fabricated
   statute number is the fastest way to lose this, and a public-sector judge is exactly the
   person who'd catch it.
2. **No state logic in `/engines`.** Nothing may branch on `"CA"` or `"TX"`. Thresholds live
   in the ontology. Test: adding a 51st state should need zero code changes.
3. **Never hand-author the graph.** Set `depends_on`, let it derive.
4. **No LLM in the engines.** They're arithmetic and comparison. AI only reads documents.
5. **Every defect names both conflicting sources**, with document, page, and field.

---

## Your git loop

```bash
git add -A && git commit -m "ontology: TX background clearance requirements" && git push

# every few hours, pull Luca's work in:
git checkout main && git pull && git checkout christopher && git merge main

# when something works, put it in main:
git checkout main && git pull && git merge christopher && git push && git checkout christopher
```

**Merge to main early and often.** Luca can't use what's sitting on your branch.
