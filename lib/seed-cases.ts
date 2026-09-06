/**
 * The starting caseload every new account gets.
 *
 * Shared by both storage backends (lib/store-json.ts and lib/store-supabase.ts)
 * so a caseworker sees the same board whether the app is running on the local
 * JSON store or on Postgres.
 *
 * ALL FAMILIES ARE FICTIONAL. CLAUDE.md hard boundary #3 — no real records,
 * ever, not even to test with. Surnames were chosen to be unmistakably
 * synthetic and the dates are anchored to today so the board never goes stale
 * between building and demoing.
 */

export interface SeedCase {
  label: string;
  sending_state: string;
  receiving_state: string;
  relationship: string;
  children_count: number;
  placement_type: string;
  /** Days before today the ICPC request was received. */
  window_offset_days: number;
  completion_pct: number;
  /** Days from today the next obligation falls due. */
  deadline_offset_days: number;
  next_deadline_label: string;
}

export const SEED_CASES: SeedCase[] = [
  {
    label: "Alvarez",
    sending_state: "CA",
    receiving_state: "TX",
    relationship: "relative",
    children_count: 3,
    placement_type: "foster",
    window_offset_days: -12,
    completion_pct: 8,
    deadline_offset_days: 6,
    next_deadline_label: "Fingerprint appointment",
  },
  {
    label: "Whitfield",
    sending_state: "TX",
    receiving_state: "CA",
    relationship: "parent",
    children_count: 1,
    placement_type: "foster",
    window_offset_days: -38,
    completion_pct: 34,
    deadline_offset_days: 11,
    next_deadline_label: "Income verification due",
  },
  {
    label: "Nakamura",
    sending_state: "CA",
    receiving_state: "TX",
    relationship: "non_relative",
    children_count: 2,
    placement_type: "adoption",
    window_offset_days: -71,
    completion_pct: 58,
    deadline_offset_days: 19,
    next_deadline_label: "Home study walkthrough",
  },
  {
    label: "Boateng",
    sending_state: "TX",
    receiving_state: "CA",
    relationship: "relative",
    children_count: 2,
    placement_type: "foster",
    window_offset_days: -104,
    completion_pct: 100,
    deadline_offset_days: 27,
    next_deadline_label: "Packet filed",
  },
  {
    label: "Rivera",
    sending_state: "CA",
    receiving_state: "TX",
    relationship: "relative",
    children_count: 2,
    placement_type: "foster",
    window_offset_days: -149,
    completion_pct: 76,
    deadline_offset_days: -3,
    next_deadline_label: "Home study walkthrough",
  },
];

/** Calendar-day arithmetic on ISO dates, kept off the Date-timezone rake. */
export function isoOffsetFromToday(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Docket number: ICPC-2026-0231.
 *
 * Sequential and per-year, because a caseworker reads this over the phone to
 * another state's ICPC office and writes it on a physical folder. A random
 * slug fails both of those jobs. Postgres allocates these from a sequence; the
 * JSON store keeps its own counter. Format is identical either way.
 */
export function formatCaseId(seq: number, year: number): string {
  return `ICPC-${year}-${String(seq).padStart(4, "0")}`;
}

export const FIRST_CASE_SEQ = 231;
