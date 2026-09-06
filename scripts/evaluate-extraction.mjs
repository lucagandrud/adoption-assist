import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractDocument, extractSyntheticDocument } from "../extraction/pipeline.ts";
import { runConsistencyChecks } from "../engines/consistency.ts";
import { loadOntology } from "../ontology/schema.ts";

const root = process.cwd();
const live = process.argv.includes("--live");
const expected = JSON.parse(
  await readFile(path.join(root, "demo/fixtures/extraction/expected.json"), "utf8"),
);
const ontology = loadOntology();
const results = [];

for (const [fileName, fixture] of Object.entries(expected)) {
  const variant = fileName.includes("conflict") ? "conflicting" : "consistent";
  const filePath = path.join(root, "demo/documents", fileName);
  const bytes = await readFile(filePath);
  const metadata = { name: fileName, type: "application/pdf", size: bytes.length };
  const extraction = live
    ? await extractDocument(metadata, bytes, fixture.definition_id, ontology)
    : extractSyntheticDocument(metadata, fixture.definition_id, ontology, variant);
  const actual = new Map(extraction.facts.map((fact) => [fact.type, fact]));
  let correct = 0;
  for (const wanted of fixture.facts) {
    const fact = actual.get(wanted.type);
    if (
      fact &&
      String(fact.value) === String(wanted.value) &&
      fact.provenance[0]?.page === wanted.page &&
      Boolean(fact.provenance[0]?.field)
    ) correct += 1;
  }
  const allowed = new Set(
    ontology.documents.find(({ id }) => id === fixture.definition_id)?.yields_facts ?? [],
  );
  assert.ok(extraction.facts.every(({ type }) => allowed.has(type)), `${fileName}: out-of-contract fact`);
  results.push({
    file: fileName,
    expected: fixture.facts.length,
    extracted: extraction.facts.length,
    correct,
    precision: extraction.facts.length ? correct / extraction.facts.length : 1,
    recall: fixture.facts.length ? correct / fixture.facts.length : 1,
    provenanceComplete: extraction.facts.every(
      ({ provenance }) => provenance[0]?.page && provenance[0]?.field,
    ),
  });
}

const application = results[0];
assert.ok(application, "Evaluation set is empty");
const extractFixture = async (name) => {
  const fixture = expected[name];
  const bytes = await readFile(path.join(root, "demo/documents", name));
  const metadata = { name, type: "application/pdf", size: bytes.length };
  return live
    ? extractDocument(metadata, bytes, fixture.definition_id, ontology)
    : extractSyntheticDocument(
        metadata,
        fixture.definition_id,
        ontology,
        name.includes("conflict") ? "conflicting" : "consistent",
      );
};
const appFacts = (await extractFixture("rfa-application-rivera.pdf")).facts;
const conflictFacts = (await extractFixture("home-safety-assessment-conflict.pdf")).facts;
const correctedFacts = (await extractFixture("home-safety-assessment-corrected.pdf")).facts;
const conflictDetected = runConsistencyChecks(
  [...appFacts, ...conflictFacts],
  ontology.rules,
  ontology,
).some(({ rule_id }) => rule_id === "rule-address-consistency");
const correctedClears = !runConsistencyChecks(
  [...appFacts, ...correctedFacts],
  ontology.rules,
  ontology,
).some(({ rule_id }) => rule_id === "rule-address-consistency");

const totals = results.reduce(
  (sum, row) => ({
    expected: sum.expected + row.expected,
    extracted: sum.extracted + row.extracted,
    correct: sum.correct + row.correct,
  }),
  { expected: 0, extracted: 0, correct: 0 },
);
const report = {
  mode: live ? "live_anthropic" : "deterministic_replay",
  files: results.length,
  fieldPrecision: totals.extracted ? totals.correct / totals.extracted : 1,
  fieldRecall: totals.expected ? totals.correct / totals.expected : 1,
  provenanceComplete: results.every(({ provenanceComplete }) => provenanceComplete),
  conflictDetected,
  correctedDocumentClearsConflict: correctedClears,
  results,
};

console.log(JSON.stringify(report, null, 2));
if (
  report.fieldPrecision < 1 ||
  report.fieldRecall < 1 ||
  !report.provenanceComplete ||
  !conflictDetected ||
  !correctedClears
) process.exitCode = 1;
