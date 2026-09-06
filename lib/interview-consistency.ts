/**
 * STAND-IN FOR engines/consistency.ts. DELETE THIS FILE WHEN THAT LANDS.
 *
 * engines/consistency.ts is a design sketch with no exports, and /engines is
 * not this branch's to edit. Until it exists, this is a small deterministic
 * comparator over the case fact store: accepted interview facts against the
 * seeded document facts. No LLM, no scoring — arithmetic and string
 * comparison only (CLAUDE.md §7, "AI extracts; arithmetic decides").
 *
 * It emits the existing `Defect` shape with BOTH sides named in
 * `conflicting[]`, so the node panel renders an interview-vs-document
 * contradiction exactly as it renders a document-vs-document one.
 *
 * The rules below are authored stand-ins with PLACEHOLDER citations and are
 * shown as such. They are not sourced regulation.
 */

import type { CaseFact } from "@/lib/fact-store";
import type { ConflictingSource, Defect } from "@/lib/types";

const PLACEHOLDER = { text: "PLACEHOLDER — stand-in rule, not sourced", url: null, retrieved: null };

/** Filers on a return, by IRS filing status. Deterministic lookup, no guessing. */
const FILERS_BY_STATUS: Record<string, number> = {
  "single": 1,
  "head of household": 1,
  "married filing separately": 1,
  "qualifying surviving spouse": 1,
  "qualifying widow(er)": 1,
  "married filing jointly": 2,
};

function toSource(fact: CaseFact): ConflictingSource {
  if (fact.provenance.source === "document") {
    return {
      fact_id: fact.fact_id,
      value: fact.value,
      document_id: fact.provenance.document_id,
      document_name: fact.provenance.document_name + (fact.fixture ? " (fixture)" : ""),
      page: fact.provenance.page,
      field: fact.provenance.field,
    };
  }
  const p = fact.provenance;
  const who = fact.subject_name;
  return {
    fact_id: fact.fact_id,
    value: fact.value,
    document_id: `interview:${p.session_id}`,
    document_name: `Intake interview${who ? ` — ${who}` : ""}`,
    page: null,
    field: `turn #${p.turn_index} · "${p.verbatim}"`,
  };
}

function parseCount(value: string): number | null {
  const n = Number.parseInt(value.replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Rule: the household size reported in the interview must equal the number
 * of people on the tax return — filers (from filing status) plus dependents
 * claimed. Skips silently when any of the three facts is missing or
 * unparseable; a rule that cannot be evaluated emits nothing.
 */
function householdSizeVsTaxReturn(facts: CaseFact[]): Defect[] {
  const dependents = facts.find(
    (f) => f.fact_id === "dependents_claimed" && f.provenance.source === "document",
  );
  const filing = facts.find(
    (f) => f.fact_id === "filing_status" && f.provenance.source === "document",
  );
  if (!dependents || !filing) return [];

  const dependentCount = parseCount(dependents.value);
  const filers = FILERS_BY_STATUS[filing.value.trim().toLowerCase()];
  if (dependentCount === null || filers === undefined) return [];
  const onReturn = filers + dependentCount;

  const out: Defect[] = [];
  for (const declared of facts.filter(
    (f) => f.fact_id === "household_size" && f.provenance.source === "interview",
  )) {
    const size = parseCount(declared.value);
    if (size === null || size === onReturn) continue;
    out.push({
      rule_id: "rule-household-size-vs-tax-return",
      severity: "blocking",
      message:
        `The interview reports ${size} people living in the home. The tax return is filed ` +
        `"${filing.value}" (${filers} filer${filers === 1 ? "" : "s"}) and claims ` +
        `${dependentCount} dependent${dependentCount === 1 ? "" : "s"}, which puts ${onReturn} ` +
        `people on the return. Which is current, and who is not accounted for?`,
      citation: PLACEHOLDER,
      conflicting: [toSource(declared), toSource(dependents), toSource(filing)],
    });
  }
  return out;
}

/**
 * Rule: two interview subjects on the same case must agree on household
 * size. Names both interviews.
 */
function householdSizeAcrossInterviews(facts: CaseFact[]): Defect[] {
  const sizes = facts.filter(
    (f) => f.fact_id === "household_size" && f.provenance.source === "interview",
  );
  const out: Defect[] = [];
  for (let i = 0; i < sizes.length; i += 1) {
    for (let j = i + 1; j < sizes.length; j += 1) {
      const a = parseCount(sizes[i].value);
      const b = parseCount(sizes[j].value);
      if (a === null || b === null || a === b) continue;
      out.push({
        rule_id: "rule-household-size-across-interviews",
        severity: "warning",
        message: `Two household members gave different household sizes (${a} and ${b}).`,
        citation: PLACEHOLDER,
        conflicting: [toSource(sizes[i]), toSource(sizes[j])],
      });
    }
  }
  return out;
}

const RULES = [householdSizeVsTaxReturn, householdSizeAcrossInterviews];

/** Every defect the stand-in rules find over the given facts. Pure. */
export function checkInterviewConsistency(facts: CaseFact[]): Defect[] {
  return RULES.flatMap((rule) => rule(facts));
}
