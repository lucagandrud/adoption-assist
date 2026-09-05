# /ontology/tx — Texas

Texas uses **DFPS home screening and licensing** — a structurally different regime from
California's unified Resource Family Approval process.

That difference is the point. Engine 4 computes the CA↔TX delta, and the delta is where
families get surprised.

## Layout

Author **one file per requirement group**, not one large file per state:

```
requirements/
  background-checks.json
  home-screening.json
  financial.json
  health-safety.json
documents/
  ...
rules/
  ...
```

This is a merge-conflict decision as much as an organizational one — two people adding
requirements to the same file conflict on every commit. New files never conflict.

## Both directions

Texas appears in this project as a **sending** state (TX → CA) and as a **receiving** state
(CA → TX). Every `Requirement` carries a `direction` field. Requirements a state imposes when
it receives a child are generally not the same as those it applies when sending one.

## Before authoring

Read [`/ontology/README.md`](../README.md) for the authoring rules. The two that matter most:

- **Every entry carries `source_citation` and `verified`.** Unsourced → `verified: false`.
  Never invent a citation. (Hard boundary #4.)
- **Log every citation in [`docs/SOURCES.md`](../../docs/SOURCES.md) as you go.**
  Reconstructing citations afterward does not happen.

## Where to look

- Texas DFPS — home screening and licensing standards
- The Texas Administrative Code chapters those standards implement

**Verify you have the current version.** A superseded citation is a defect.

## Status

❌ No requirement data authored yet. This is the long pole — start before the 26-hour window
opens (research and data collection only; confirm DNHacks rules on advance work first).
