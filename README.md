# ICPC Preflight

Pre-submission verification for interstate foster care and adoption placements.

Caseworkers assemble a placement packet, the system derives the required document
workflow from state regulations, and every uploaded document is checked against the
others before the packet is filed.

**Live:** https://foster-care-compliance.vercel.app

---

## The problem

A child placed across state lines must be approved under the Interstate Compact on the
Placement of Children. The receiving state runs a home study and approves or denies.

| | |
|---|---|
| ICPC home study requests per year | ~40,000 |
| Placement requests denied | ~40% |
| Statutory decision window | 180 calendar days |
| Right of appeal | None |
| Caseworker time spent on documentation | 4.3 hours of every 8-hour day |

Sources in [docs/SOURCES.md](docs/SOURCES.md).

A denial carries no appeal. The only remedy is filing again, and the clock restarts while
the child stays in care. A meaningful share of those denials are administrative: an address
that disagrees between two documents, a clearance that lapsed at day 140 of 180, a form
filed out of sequence.

NEICE already moves ICPC packets electronically between state offices. It transmits
documents. It does not evaluate whether the packet is correct. This project is the layer
that runs before the packet enters that pipe.

## What it does

- Derives a branching document workflow from the sending and receiving states' requirements
- Computes the critical path and the earliest achievable filing date
- Extracts typed facts from uploaded documents, each carrying page and field provenance
- Flags contradictions between documents, naming both sources
- Runs a scripted intake interview with household members and folds the answers into the
  same fact graph

A green check means the paperwork is consistent and complete. It never means the family is
approved. The system does not score, rank, or recommend.

## How it works

```
/ontology     requirements, documents, consistency rules as versioned data
/engines      graph derivation, consistency, validity, state-pair delta
/extraction   document -> typed facts with provenance
/app          caseworker UI, interview surface, API routes
```

**The workflow graph is derived, not authored.** Requirements declare `depends_on` edges;
the DAG is computed from them and laid out automatically. No node list is written by hand,
so changing the state pair changes the graph. State-specific content lives only in
`/ontology`; there is no state logic in code, which is what makes the architecture extend
past the two states encoded here.

**Arithmetic decides, AI extracts.** Claude reads documents and interview answers into
typed facts. Graph derivation, date math against the 180-day window, and the consistency
rules are deterministic code. No model decides whether a requirement is met.

**Provenance everywhere.** Every fact traces to a document page and field, or to the exact
utterance that produced it. Every requirement carries its citation, and anything unsourced
is marked unverified in the UI rather than presented as regulation.

## The intake interview

Psycho-social evaluation requires interviewing each adult in the household, which is
expensive when the caseworker is in another state. The caseworker sends an expiring link;
the household member answers by voice or text in the browser with no account.

Three properties make it defensible:

1. **The question script is authored data, not model output.** A deterministic state machine
   owns sequencing. The model may extract facts, acknowledge, and ask at most one bounded
   clarification. Every household member is asked the same questions in the same words.
2. **The response schema has no field that can carry an assessment.** Not a prompt
   instruction, a structural one. There is nowhere for a score to go.
3. **Everything is a draft until a caseworker accepts it**, and the verbatim transcript sits
   beside every extracted value.

Because interview facts are the same object as document facts, a contradiction between them
is an ordinary defect. If the interview says four people live in the home and the tax return
shows two filers and three dependents, both sources are named with page and field.

## Security and data handling

- Postgres row-level security on every table, keyed to `auth.uid()`. A route handler that
  forgets to filter by user still cannot return another caseworker's cases.
- The interview link is opened by someone with no account, so RLS keyed to a user id would
  return nothing. Anonymous access goes through token-scoped `SECURITY DEFINER` functions
  and the anonymous role has no direct table access at all. The token is the capability, it
  expires, and it reaches exactly one session.
- No video is recorded. The camera is previewed locally so the session feels like a call.
- Consent precedes the microphone, and it discloses that Chrome's speech service transmits
  audio to Google, with a text option for anyone who would rather it did not.
- All demo data is synthetic.

## Running it

```bash
npm install
npm run dev
```

Supabase connection details are committed in `.env`; the anon key is public by design and
RLS is what protects the data. Document and interview extraction need an `ANTHROPIC_API_KEY`
in `.env.local`. Without one the app runs and records verbatim answers, it just does not
extract facts.

Schema lives in `supabase/migrations/`.

## Deployment and cost

Next.js on Vercel, Postgres and auth on Supabase, both on free tiers. Per-case marginal cost
is a handful of Claude calls, on the order of cents. There is no per-seat infrastructure and
nothing to install in a county office.

The integration path is deliberate: this feeds NEICE rather than replacing it. NEICE is
required of all states by 2027 under the Family First Prevention Services Act, and 47
jurisdictions are already operational, so the packet format and the destination already
exist. The unit of adoption is a single state agency, and the ontology is per-jurisdiction
data, so onboarding a new state is an encoding task rather than an engineering one.

## What is real and what is not

Built and working: the derived workflow graph and critical path, document extraction with
provenance, cross-document consistency checks, the interview agent end to end, real accounts
with row-level isolation, and the deployment above.

Not built: requirement data for the other 48 states. Where a requirement has no sourced
citation it is marked `verified: false` and the interface says so rather than inventing one.
The impact model is deliberately not reduced to a single dollar figure, because the fraction
of denials that are administrative rather than substantive is not something we can source,
and guessing it would be the least honest number in the project.
