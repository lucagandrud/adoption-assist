/* =============================================================================
 * PSEUDOCODE — NOT IMPLEMENTED
 * =============================================================================
 * Nothing in this file executes. There are no imports, no exports, and no
 * runnable statements — only a commented design sketch.
 *
 * File:    engines/graph.ts
 * Purpose: Engine 3 — DAG construction from Requirement.depends_on edges,
 *          plus critical path and earliest achievable submission date.
 * Owner:   unassigned
 * Phase:   Hours 10–16 (the largest single block)
 * Status:  ⭐ NEVER CUT. With Engine 1, this is the project.
 *
 * This is the PRIMARY UI. Not sequential screens.
 * ============================================================================= */

// ---------------------------------------------------------------------------
// OUTPUT SHAPE
// ---------------------------------------------------------------------------
//
// NodeState        enum: "locked" | "available" | "in_progress"
//                      | "complete" | "defect"
//
// GraphNode        object:
//                    requirement_id    string
//                    label             string
//                    state             NodeState
//                    on_critical_path  boolean
//                    slack_days        number    0 on the critical path
//                    earliest_start    date
//                    earliest_finish   date
//                    inputs            InputStatus[]
//                    citation          Citation
//                    verified          boolean
//                    defects           Defect[]  from Engine 1
//
// InputStatus      object:
//                    kind        enum: "document" | "fact"
//                    id          string
//                    label       string
//                    satisfied   boolean
//
// GraphModel       object:
//                    nodes                  GraphNode[]
//                    edges                  { from, to }[]
//                    critical_path          string[]   requirement ids, ordered
//                    earliest_submission    date
//                    recommended_order      string[]
//
// ---------------------------------------------------------------------------
// STEP 1 — BUILD THE DAG
// ---------------------------------------------------------------------------
//
// function buildGraph(ontology, statePair, familyProfile) -> GraphModel
//
//     select the applicable requirements:
//         - direction matches (sending state's sending reqs,
//           receiving state's receiving reqs)
//         - applies_to matches the family profile (relative, parent, etc.)
//         - plus all /shared federal requirements
//
//     nodes = one per selected requirement
//     edges = for each requirement, one edge per depends_on entry
//
//     ⚠️ DERIVED, NEVER HAND-AUTHORED. If anyone writes a literal node/edge
//     list anywhere in this codebase, that is the bug. (CLAUDE.md §6.1)
//
//     ⚠️ DANGLING EDGES: a depends_on pointing at a requirement filtered out
//     by direction or applies_to is NOT an error — it is a dependency that
//     does not apply to this family. DROP the edge; do not drop the node and
//     do not throw. Getting this backwards silently disconnects the graph.
//
//     assert acyclic (boot validation should already guarantee this)
//
// ---------------------------------------------------------------------------
// STEP 2 — CRITICAL PATH
// ---------------------------------------------------------------------------
// Standard CPM forward/backward pass. Node duration comes from
// external_turnaround_days on the documents that satisfy the requirement.
//
//     duration(node) = MAX over satisfied_by_documents of
//                          document.external_turnaround_days
//         // MAX, not SUM — a family orders documents in parallel. Summing
//         // them inflates every estimate and makes the earliest-submission
//         // date indefensible.
//         // Missing turnaround → treat as 0 but RECORD IT. A silently-zero
//         // duration corrupts the critical path. Surface these as a data
//         // quality warning in the ontology loader.
//
//     forward pass  (topological order):
//         earliest_start(n)  = MAX(earliest_finish(predecessors)), 0 if none
//         earliest_finish(n) = earliest_start(n) + duration(n)
//
//     project_finish = MAX(earliest_finish) over all nodes
//
//     backward pass (reverse topological order):
//         latest_finish(n) = MIN(latest_start(successors)),
//                            project_finish if none
//         latest_start(n)  = latest_finish(n) - duration(n)
//
//     slack(n) = latest_start(n) - earliest_start(n)
//     critical path = the connected chain of nodes where slack == 0
//
//     earliest_submission = today + project_finish (calendar days)
//
// NOTE: work already complete should have duration 0 on recompute, so the
// projection tightens as the family progresses. That live-updating date is a
// strong demo moment — call it out on stage.
//
// ---------------------------------------------------------------------------
// STEP 3 — NODE STATE
// ---------------------------------------------------------------------------
//
// for each node:
//     if any Engine 1 defect references this requirement  → "defect"
//     else if all inputs satisfied                        → "complete"
//     else if all predecessors complete:
//         if some inputs present                          → "in_progress"
//         else                                            → "available"
//     else                                                → "locked"
//
// ⚠️ "defect" OUTRANKS "complete". A node whose inputs are all present but
// which carries a contradiction must NOT read as done. Order these checks as
// written.
//
// ---------------------------------------------------------------------------
// STEP 4 — THE AUTOMATE ACTION
// ---------------------------------------------------------------------------
// Available on a node when all of its inputs are present.
//
// function automate(requirement_id):
//     run the extraction pipeline over that node's documents
//     populate facts (with provenance)
//     run ConsistencyRules whose facts_involved intersect this node's facts
//     if defects:  node → "defect", show them with citations, STOP
//     else:        node → "complete", recompute graph, unlock downstream
//
//     ⚠️ Recompute the WHOLE graph after any Automate. Completing a node
//     changes durations and can move the critical path — a locally-patched
//     node state will drift out of sync with the projected date.
//
//     UI: this is a multi-second AI call. Show per-stage progress
//     (extracting → checking → done). A spinner with no stages reads as a
//     hang on stage.
//
// ---------------------------------------------------------------------------
// UI CONTRACT (React Flow)
// ---------------------------------------------------------------------------
//   - graph expands DOWNWARD, nodes connect to downstream nodes
//   - auto-layout via dagre or elkjs — NEVER hand-position (CLAUDE.md §6.4)
//   - critical path nodes visually distinct from slack nodes
//   - clicking a node opens its requirement panel: input checklist, source
//     citation, verification status
//   - an unverified requirement (verified: false) must be badged as such in
//     the panel — this is hard boundary #4 made visible
//
// LAYOUT STABILITY: re-running layout after every Automate can reshuffle the
// whole canvas and disorient the user mid-demo. Either seed the layout
// deterministically or preserve positions for unchanged nodes. Worth the time
// — a graph that jumps on every click looks broken even when it is correct.
