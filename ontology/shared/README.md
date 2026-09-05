# /ontology/shared

Federal ICPC requirements and the canonical fact type registry. **Anything true regardless
of state goes here.**

## What belongs here

- **Federal ICPC requirements** — obligations imposed by the compact itself rather than by
  either state. The ICPC-100A and 100B, the 180-day decision window, the sending-agency
  filing structure.
- **Canonical fact types** — the registry of every `Fact.type` key in the system. Both CA
  and TX ontology entries reference these keys, so the registry is what makes cross-state
  comparison possible at all.

## Why the fact type registry matters

If California models "household income" and Texas models "annual gross income" as separate
fact types, Engine 1 can never compare them and Engine 4 can never match the requirements
that use them. **The registry is the shared vocabulary.** Agree on it before authoring
either state.

Each fact type entry should carry:
- the canonical key
- a value type and any unit convention (gross vs. AGI, annual vs. monthly)
- a short description of what counts as this fact

That unit convention is not a detail. Comparing gross income against AGI produces a false
defect on every self-employed family.

## What does not belong here

State-specific thresholds, validity periods, or forms — even if CA and TX currently happen
to agree. Duplicating a value into both state directories is correct; if one state changes
it later, Engine 4 should surface that as a real delta rather than silently inheriting a
shared constant.

## Status

❌ Empty. The fact type registry is the first thing to author — everything else references it.
