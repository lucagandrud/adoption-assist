import assert from "node:assert/strict";
import { runConsistencyChecks } from "../engines/consistency.ts";
import { computeDelta } from "../engines/delta.ts";
import { buildGraphModel } from "../engines/graph.ts";
import {
  addCalendarDays,
  calendarDaysBetween,
  computeValidity,
} from "../engines/validity.ts";
import { loadOntology } from "../ontology/schema.ts";
import { extractSyntheticDocument } from "../extraction/pipeline.ts";

const ontology = loadOntology();
assert.equal(ontology.requirements.length, 95);
assert.equal(ontology.documents.length, 81);
assert.equal(Object.keys(ontology.factTypes).length, 31);
assert.equal(ontology.rules.length, 4);
assert.equal(ontology.actions.length, 5);

const graphInput = (sending_state, receiving_state) => ({
  id: "verification-case",
  label: "Verification Case",
  sending_state,
  receiving_state,
  profile: {
    relationship: "relative",
    children_count: 2,
    placement_type: "foster",
  },
  window_start: "2026-09-05",
});

const caToTx = buildGraphModel(ontology, graphInput("CA", "TX"));
const txToCa = buildGraphModel(ontology, graphInput("TX", "CA"));
assert.equal(caToTx.nodes.length, 35);
assert.equal(txToCa.nodes.length, 65);
assert.notDeepEqual(
  caToTx.nodes.map(({ requirement_id }) => requirement_id),
  txToCa.nodes.map(({ requirement_id }) => requirement_id),
);
assert.equal(caToTx.source, "engine");

function longestPathLength(edges) {
  const predecessors = new Map();
  for (const { from, to } of edges) {
    predecessors.set(to, [...(predecessors.get(to) ?? []), from]);
  }
  const memo = new Map();
  const depth = (id) => {
    if (memo.has(id)) return memo.get(id);
    const value = 1 + Math.max(0, ...(predecessors.get(id) ?? []).map(depth));
    memo.set(id, value);
    return value;
  };
  return Math.max(0, ...[...predecessors.keys()].map(depth));
}

assert.ok(longestPathLength(caToTx.edges) >= 4);
assert.ok(longestPathLength(txToCa.edges) >= 4);

const extractedAt = "2026-09-05T12:00:00.000Z";
const addressFact = (id, value, document_name) => ({
  id,
  type: "fact.residence.address",
  value,
  confidence: 1,
  extracted_at: extractedAt,
  provenance: [
    {
      source_kind: "document",
      document_id: id,
      document_name,
      page: 1,
      field: "Address",
      extracted_at: extractedAt,
    },
  ],
});
const addressRules = ontology.rules.filter(
  ({ expression }) => expression === "addresses_match",
);
assert.equal(
  runConsistencyChecks(
    [
      addressFact("a", "1442 Oak Street, Sacramento CA 95814-1234", "Tax return"),
      addressFact("b", "1442 OAK ST SACRAMENTO CA 95814", "Home study"),
    ],
    addressRules,
    ontology,
  ).length,
  0,
);
const defects = runConsistencyChecks(
  [
    addressFact("a", "1442 Oak St, Sacramento CA 95814", "Tax return"),
    addressFact("b", "88 Cedar Ave, Sacramento CA 95818", "Home study"),
  ],
  addressRules,
  ontology,
);
assert.equal(defects.length, 1);
assert.equal(defects[0].conflicting.length, 2);
assert.match(defects[0].message, /Which is current\?/);

const cachedApplication = extractSyntheticDocument(
  { name: "application.pdf", type: "application/pdf", size: 1 },
  "doc-rfa-application-form-rfa01a",
  ontology,
  "consistent",
);
const cachedAssessment = extractSyntheticDocument(
  { name: "assessment.pdf", type: "application/pdf", size: 1 },
  "doc-home-health-safety-assessment-report",
  ontology,
  "conflicting",
);
const cachedDefects = runConsistencyChecks(
  [...cachedApplication.facts, ...cachedAssessment.facts],
  ontology.rules,
  ontology,
);
assert.ok(
  cachedDefects.some(({ rule_id }) => rule_id === "rule-address-consistency"),
);

assert.equal(calendarDaysBetween("2026-03-07", "2026-03-09"), 2);
assert.equal(addCalendarDays("2026-03-07", 2), "2026-03-09");
const validity = computeValidity(
  [
    {
      id: "health-screening-1",
      document_id: "doc-health-screening-form",
      issue_date: "2026-01-01",
    },
  ],
  ontology,
  "2026-09-01",
  "2027-02-28",
  "2026-09-05",
);
assert.equal(validity.items[0].state, "at_risk");

const delta = computeDelta(ontology, "CA", "TX", "relative");
assert.ok(delta.items.length > 0);
assert.equal(
  delta.surprise_count,
  delta.items.filter(({ kind }) => kind === "only_in_receiving").length,
);

console.log(
  `Ontology verified: ${ontology.requirements.length} requirements, ${ontology.documents.length} documents, CA->TX ${caToTx.nodes.length} nodes, TX->CA ${txToCa.nodes.length} nodes.`,
);
