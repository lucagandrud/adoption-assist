import type {
  ConsistencyRule,
  Fact,
  LoadedOntology,
  Provenance,
} from "../ontology/schema.ts";
import type { Citation, Defect } from "../lib/types.ts";

type ComparatorResult = {
  violated: boolean;
  facts: Fact[];
};

type Comparator = (
  groups: Fact[][],
  rule: ConsistencyRule,
) => ComparatorResult;

const ADDRESS_WORDS: Record<string, string> = {
  STREET: "ST",
  ROAD: "RD",
  AVENUE: "AVE",
  BOULEVARD: "BLVD",
  DRIVE: "DR",
  LANE: "LN",
  COURT: "CT",
  PLACE: "PL",
  PARKWAY: "PKWY",
  HIGHWAY: "HWY",
  NORTH: "N",
  SOUTH: "S",
  EAST: "E",
  WEST: "W",
  APARTMENT: "UNIT",
  APT: "UNIT",
  SUITE: "UNIT",
};

function normalizedWords(value: unknown): string[] {
  return String(value)
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/#/g, " UNIT ")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .replace(/-/g, " ")
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);
}

export function normalizeAddress(value: unknown): string {
  const words = normalizedWords(value).map((word) => ADDRESS_WORDS[word] ?? word);
  const zipIndex = words.findIndex((word) => /^\d{5}$/.test(word));
  if (zipIndex >= 0 && /^\d{4}$/.test(words[zipIndex + 1] ?? "")) {
    words.splice(zipIndex + 1, 1);
  }
  return words.join(" ");
}

const NAME_SUFFIXES = new Set(["JR", "SR", "II", "III", "IV", "V"]);

export function normalizeName(value: unknown): { first: string; last: string } {
  const parts = normalizedWords(value).filter((part) => !NAME_SUFFIXES.has(part));
  return { first: parts[0] ?? "", last: parts.at(-1) ?? "" };
}

function firstMismatch(
  facts: Fact[],
  normalize: (value: unknown) => unknown,
): Fact[] {
  for (let left = 0; left < facts.length; left += 1) {
    for (let right = left + 1; right < facts.length; right += 1) {
      if (
        JSON.stringify(normalize(facts[left].value)) !==
        JSON.stringify(normalize(facts[right].value))
      ) {
        return [facts[left], facts[right]];
      }
    }
  }
  return [];
}

const comparators: Record<ConsistencyRule["expression"], Comparator> = {
  addresses_match: ([facts]) => {
    const mismatch = firstMismatch(facts, normalizeAddress);
    return { violated: mismatch.length > 0, facts: mismatch };
  },
  names_match: ([facts]) => {
    const mismatch = firstMismatch(facts, normalizeName);
    return { violated: mismatch.length > 0, facts: mismatch };
  },
  household_size_consistent: ([facts]) => {
    const mismatch = firstMismatch(facts, (value) => Number(value));
    return { violated: mismatch.length > 0, facts: mismatch };
  },
  bedrooms_support_child_count: (groups) => {
    const [bedroomFact] = groups[0];
    const [childFact] = groups[1];
    const [limitFact] = groups[2];
    const bedroomCount = Number(bedroomFact.value);
    const childCount = Number(childFact.value);
    const childrenPerBedroom = Number(limitFact.value);
    const validNumbers = [bedroomCount, childCount, childrenPerBedroom].every(
      Number.isFinite,
    );
    return {
      violated:
        validNumbers && childCount > bedroomCount * childrenPerBedroom,
      facts: validNumbers
        ? [bedroomFact, childFact, limitFact]
        : [],
    };
  },
};

function primaryProvenance(fact: Fact): Provenance {
  return fact.provenance[0];
}

function documentLabel(documentId: string, ontology: LoadedOntology): string {
  const document = ontology.documents.find(({ id }) => id === documentId);
  return document ? humanize(document.type) : humanize(documentId);
}

function humanize(value: string): string {
  return value
    .replace(/^(doc|req|fact)-/, "")
    .replace(/^fact\./, "")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toConflictSource(fact: Fact, ontology: LoadedOntology) {
  const provenance = primaryProvenance(fact);
  const documentId = provenance.document_id ?? "manual-entry";
  return {
    fact_id: fact.id,
    value: String(fact.value),
    document_id: documentId,
    document_name:
      provenance.document_name ??
      (provenance.source_kind === "manual"
        ? "Caseworker entry"
        : documentLabel(documentId, ontology)),
    page: provenance.page ?? null,
    field: provenance.field ?? humanize(fact.type),
  };
}

function renderMessage(template: string, sourceNames: string[]): string {
  return template
    .replaceAll("{source_a}", sourceNames[0] ?? "the first source")
    .replaceAll("{source_b}", sourceNames[1] ?? "the second source");
}

const severityRank = { blocking: 0, warning: 1, info: 2 } as const;

export function runConsistencyChecks(
  facts: Fact[],
  rules: ConsistencyRule[],
  ontology: LoadedOntology,
): Defect[] {
  const factsByType = new Map<string, Fact[]>();
  for (const fact of facts) {
    const group = factsByType.get(fact.type) ?? [];
    group.push(fact);
    factsByType.set(fact.type, group);
  }

  const defects: Defect[] = [];
  for (const rule of rules) {
    const groups = rule.facts_involved.map(
      (factType) => factsByType.get(factType) ?? [],
    );
    if (groups.some((group) => group.length === 0)) continue;
    if (groups.length === 1 && groups[0].length < 2) continue;

    const result = comparators[rule.expression](groups, rule);
    if (!result.violated || result.facts.length < 2) continue;

    const conflicting = result.facts.map((fact) =>
      toConflictSource(fact, ontology),
    );
    const lowConfidence = result.facts.some(({ confidence }) => confidence < 0.8);
    defects.push({
      rule_id: rule.id,
      severity: lowConfidence && rule.severity === "blocking" ? "warning" : rule.severity,
      message: `${lowConfidence ? "One or more extracted values need human review. " : ""}${renderMessage(
        rule.defect_message,
        conflicting.map(({ document_name }) => document_name),
      )}`,
      citation: rule.source_citation as Citation,
      conflicting,
    });
  }

  return defects.sort(
    (left, right) =>
      (severityRank[left.severity as keyof typeof severityRank] ?? 99) -
      (severityRank[right.severity as keyof typeof severityRank] ?? 99),
  );
}
