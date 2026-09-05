# /app/api — route handlers

Next.js App Router route handlers. One repo, one deploy target — no separate backend, no
microservices.

## Expected routes

| Route | Purpose |
|---|---|
| `POST /api/upload` | Accept a document, store it in Supabase, kick off extraction |
| `POST /api/automate` | The Automate action — extract, populate facts, run rules, recompute graph |
| `POST /api/interview` | Voice/chat intake turn |
| `GET  /api/graph` | Current `GraphModel` for a family |
| `GET  /api/validity` | Current `ValidityReport` |
| `GET  /api/delta` | `DeltaReport` for a state pair |

## Rules

**1. Secrets stay server-side.** The Anthropic API key and the Supabase service role key are
never exposed to the client. `.env` is gitignored — keep it that way.

**2. Engines run here, not in the browser.** Route handlers call `/engines` and return plain
data. This keeps the ontology off the wire and the logic in one place.

**3. Validate at the boundary.** Parse every request body through Zod. The same discipline
applied to extraction responses applies to client input.

**4. No real PII, ever.** Hard boundary #3. Upload endpoints accept synthetic demo documents
only. This is a hackathon demo with no compliance posture — do not build anything that could
tempt someone to put a real record through it.

**5. Automate is a multi-second call.** Stream or report per-stage progress
(`extracting → checking → done`). A route that returns nothing for eight seconds reads as a
hang on stage.
