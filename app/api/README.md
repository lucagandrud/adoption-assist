# /app/api — route handlers

Next.js App Router route handlers. One repo, one deploy target — no separate backend.

## Expected routes

| Route | Purpose |
|---|---|
| `GET  /api/cases` | Cases assigned to the signed-in caseworker |
| `POST /api/cases` | Create a case: state pair, direction, family profile |
| `GET  /api/workflow/[caseId]` | Composed `GraphModel` for the case |
| `POST /api/upload` | Accept a document, store it in Supabase, kick off extraction |
| `POST /api/verify` | Extract → ontologize → run rules → green check or defect |
| `POST /api/action` | Invoke an ontology verb (`verify`, `override`, `mark_filed`) |

## Rules

**1. Secrets stay server-side.** The Anthropic API key and the Supabase service role key are
never exposed to the client. `.env` is gitignored — keep it that way.

**2. Engines run here, not in the browser.** Route handlers call `/engines` and return plain
data. Keeps the ontology off the wire and the logic in one place.

**3. Validate at the boundary.** Parse every request body through Zod. The discipline applied
to extraction responses applies to client input.

**4. `/api/action` writes an audit event, never a patched field.** Every invocation appends an
`ActionEvent` with actor, timestamp, and prior/next state. Requirement state is *derived* by
folding those events. An `override` requires a written note — someone will eventually ask who
cleared a defect and why.

**5. No real records.** Hard boundary #3. Upload accepts synthetic demo documents only. This
is a hackathon demo with no compliance posture — do not build anything that tempts someone to
put a real case file through it.

**6. `/api/verify` is a multi-second AI call.** Stream or report per-stage progress
(`reading → extracting → checking → done`). A route that returns nothing for eight seconds
reads as a hang on stage.
