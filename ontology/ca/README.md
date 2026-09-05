# /ontology/ca — California

California uses **Resource Family Approval (RFA)** as a unified process — a single approval
covering foster care, relative placement, and adoption, rather than separate tracks.

That structural difference from Texas is the reason these two states were chosen. Engine 4
computes the delta between them, and the delta is where families get surprised.

## Layout

Author **one file per requirement group**, not one large file per state:

```
requirements/
  background-checks.json
  home-study.json
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

California appears in this project as a **sending** state (CA → TX) and as a **receiving**
state (TX → CA). Every `Requirement` carries a `direction` field. Requirements a state
imposes when it receives a child are generally not the same as those it applies when
sending one.

## Before authoring

Read [`/ontology/README.md`](../README.md) for the authoring rules. The two that matter most:

- **Every entry carries `source_citation` and `verified`.** Unsourced → `verified: false`.
  Never invent a citation. (Hard boundary #4.)
- **Log every citation in [`docs/SOURCES.md`](../../docs/SOURCES.md) as you go.**
  Reconstructing citations afterward does not happen.

## Where to look

- California CDSS — RFA written directives, all-county letters
- The California Code of Regulations sections those directives implement

**Verify you have the current version.** A superseded citation is a defect.

## Status

❌ No requirement data authored yet. This is the long pole — start before the 26-hour window
opens (research and data collection only; confirm DNHacks rules on advance work first).
