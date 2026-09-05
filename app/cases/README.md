# /app/cases — case shell

Deliverable **D1**. Sign in, pick a case, pick the state pair and direction. Everything before
the dashboard.

## Screens

| Screen | Purpose |
|---|---|
| Sign in | Supabase auth. Caseworker accounts only. |
| Case list | Cases assigned to this caseworker, with status |
| Case setup | Sending state, receiving state, and the family profile that drives `applies_to` filtering |

## State pair selection is not a preference — it is the input

The chosen pair and direction **compose the entire workflow**. Requirement resolution:

```
applicable = sending state's requirements    where direction = "sending"
           ∪ receiving state's requirements  where direction = "receiving"
           ∪ federal /shared requirements
           filtered by applies_to against the case's family profile
```

The DAG in `/workflow` is derived from that set. Changing the direction must produce a
visibly different graph — CA→TX and TX→CA are not the same workflow, and if they render the
same, the ontology is too thin.

Make direction unmistakable in the UI. A caseworker who picks the wrong direction gets a
confidently wrong workflow, which is worse than no tool.

## Case profile fields

Needed for `applies_to` filtering to resolve correctly:

- Relationship of the placement resource (relative, parent, non-relative)
- Number and ages of children in the placement
- Placement type (foster, adoption)

These drive which requirements apply. Getting them wrong silently drops nodes from the graph,
so validate them and show what was selected on the dashboard.

## Cut posture

If behind schedule, **auth is cut first** — hardcode a session and keep case selection. The
case and state pair are load-bearing inputs to F1; the login screen is not.
