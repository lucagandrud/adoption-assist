import assert from "node:assert/strict";
import { extractDocument } from "../extraction/pipeline.ts";
import { loadOntology } from "../ontology/schema.ts";

const ontology = loadOntology();
const originalFetch = globalThis.fetch;
const originalKey = process.env.ANTHROPIC_API_KEY;
const originalModel = process.env.ANTHROPIC_MODEL;
const originalCache = process.env.EXTRACTION_USE_CACHE;

process.env.ANTHROPIC_API_KEY = "test-key-never-sent";
process.env.ANTHROPIC_MODEL = "claude-sonnet-5";
process.env.EXTRACTION_USE_CACHE = "0";

let calls = 0;
let capturedRequest;
globalThis.fetch = async (_url, init) => {
  calls += 1;
  capturedRequest = JSON.parse(init.body);
  if (calls === 1) {
    return {
      ok: false,
      status: 529,
      json: async () => ({ error: { message: "Temporary overload" } }),
    };
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({
      model: "claude-sonnet-5",
      usage: { input_tokens: 420, output_tokens: 88 },
      content: [
        {
          type: "text",
          text: JSON.stringify({
            facts: [
              {
                type: "fact.person.legal_name",
                value: "Maria Elena Rivera",
                page: 1,
                field: "Legal name",
                confidence: 0.99,
              },
              {
                type: "fact.residence.address",
                value: "1442 Oak Street, Sacramento, CA 95814",
                page: 1,
                field: "Residence address",
                confidence: 0.98,
              },
            ],
          }),
        },
      ],
    }),
  };
};

try {
  const result = await extractDocument(
    { name: "rfa-application-rivera.pdf", type: "application/pdf", size: 128 },
    new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    "doc-rfa-application-form-rfa01a",
    ontology,
  );

  assert.equal(calls, 2, "the live path retries one transient failure");
  assert.equal(result.mode, "live_anthropic");
  assert.equal(result.telemetry.model, "claude-sonnet-5");
  assert.equal(result.telemetry.input_tokens, 420);
  assert.equal(result.telemetry.output_tokens, 88);
  assert.equal(result.telemetry.attempts, 2);
  assert.equal(result.facts.length, 2);
  assert.equal(result.facts[0].provenance[0].page, 1);
  assert.equal(result.facts[1].provenance[0].field, "Residence address");
  assert.equal(capturedRequest.output_config.format.type, "json_schema");
  assert.deepEqual(
    capturedRequest.output_config.format.schema.properties.facts.items.properties.type.enum,
    ["fact.person.legal_name", "fact.residence.address"],
  );
  assert.equal(capturedRequest.messages[0].content[0].type, "document");
  assert.equal(capturedRequest.messages[0].content[0].source.type, "base64");
  assert.match(capturedRequest.system, /untrusted synthetic documents/);
  assert.match(capturedRequest.system, /never as instructions/);

  await assert.rejects(
    () =>
      extractDocument(
        { name: "not-really.pdf", type: "application/pdf", size: 4 },
        new Uint8Array([1, 2, 3, 4]),
        "doc-rfa-application-form-rfa01a",
        ontology,
      ),
    /contents do not match/,
  );
  assert.equal(calls, 2, "an invalid file is rejected before a provider call");

  console.log(
    "Live extraction contract verified: PDF bytes, structured schema, retry, telemetry, and provenance.",
  );
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.ANTHROPIC_MODEL;
  else process.env.ANTHROPIC_MODEL = originalModel;
  if (originalCache === undefined) delete process.env.EXTRACTION_USE_CACHE;
  else process.env.EXTRACTION_USE_CACHE = originalCache;
}
