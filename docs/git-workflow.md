# Git workflow — terminal reference

Written for **two people building for 26 hours.** Everything here is copy-pastable.

At this team size and time budget, the real risk is **merge conflicts and a broken `main`
at 3am**, not insufficient code review. The workflow below optimizes for that.

Replace `<username>` with the GitHub account that owns the repo.

---

## Table of contents

- [First-time setup](#first-time-setup-each-person-once)
- [Ownership split](#ownership-split-do-this-first)
- [The daily loop](#the-daily-loop)
- [When to branch vs. push to main](#when-to-branch-vs-push-to-main)
- [Pull requests](#pull-requests)
- [Merging and conflicts](#merging-and-conflicts)
- [Checkpoint tags](#checkpoint-tags)
- [Recovery — when things go wrong](#recovery--when-things-go-wrong)
- [Cheat sheet](#cheat-sheet)

---

## First-time setup (each person, once)

### 1. Install and authenticate the GitHub CLI

```bash
brew install gh
gh auth login
```

Choose: **GitHub.com** → **SSH** → **Yes** (generate/upload a key) → **Login with a web browser**.

### 2. Set your identity

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

### 3. Sensible defaults (saves pain later)

```bash
git config --global init.defaultBranch main
git config --global pull.rebase true        # linear history, fewer merge commits
git config --global push.autoSetupRemote true
git config --global rerere.enabled true     # remember conflict resolutions
```

### 4. Clone the repo

```bash
gh repo clone <username>/icpc-compliance-engine
cd icpc-compliance-engine
```

Or with plain git:

```bash
git clone git@github.com:<username>/icpc-compliance-engine.git
cd icpc-compliance-engine
```

### 5. Read before writing code

```bash
less CLAUDE.md          # the standing brief — read fully
less README.md          # deliverables and definitions of done
```

---

## Ownership split (do this first)

**Agree on this before hour 0.** Two people editing the same files at hour 14 is how
hackathon repos die.

| Owner | Directories | Deliverables |
|---|---|---|
| **Person A** | `/ontology`, `/engines` | D0 ontology, D1 consistency, D2 validity, D4 delta |
| **Person B** | `/app`, `/extraction`, `/demo` | D3 graph UI, D5 extraction, D6 intake, D7 caseworker, D8 demo families |

**The exceptions, and how to handle them:**

- **`ontology/schema.ts`** — everything depends on it. Write it **together in hours 0–2**,
  land it on `main`, then treat it as frozen. Changing it later breaks both sides at once.
- **`engines/graph.ts`** — the logic is Person A's, the React Flow UI is Person B's. Keep
  the boundary at `GraphModel` (defined in the pseudocode). A owns producing it; B owns
  rendering it. Agree on that shape early and neither of you blocks the other.
- **`README.md` / `CLAUDE.md`** — announce in chat before editing. They conflict easily
  because both of you touch prose.

---

## The daily loop

Run this **every time you sit down**, before writing anything:

```bash
git checkout main
git pull
```

Then work. Commit often — small commits are easier to undo at 4am:

```bash
git add -A
git commit -m "ontology: encode TX fingerprint clearance requirement"
git push
```

Check what you're about to commit if you're unsure:

```bash
git status
git diff                 # unstaged changes
git diff --staged        # what's actually going in
```

### Commit message convention

Prefix with the area so `git log --oneline` is scannable at hour 20:

```
ontology:    requirement data, schema
engines:     consistency, validity, graph, delta
extraction:  pipeline, prompts
app:         UI, routes
demo:        synthetic families
docs:        README, IMPACT, SOURCES
chore:       config, deps, tooling
```

---

## When to branch vs. push to main

**Push straight to `main` when:**
- You're working inside your own directories (per the ownership split)
- The change is additive — new files, new ontology entries
- `main` is currently green and your change keeps it that way

This is the common case. At two people with clean ownership, most work goes straight to `main`.

**Branch and open a PR when:**
- You're touching the other person's directories
- You're changing `ontology/schema.ts` after it's frozen
- You're making a change you're unsure about and want a second pair of eyes
- You're doing something large and risky that might not land (a spike)

### Creating a branch

```bash
git checkout main
git pull
git checkout -b engine/consistency-name-matching
```

Branch naming:

```
ontology/<what>     ontology/tx-clearances
engine/<what>       engine/critical-path
app/<what>          app/graph-canvas
fix/<what>          fix/timeline-dst-offset
spike/<what>        spike/elkjs-layout
```

Push it:

```bash
git push -u origin engine/consistency-name-matching
```

---

## Pull requests

```bash
gh pr create --fill
```

`--fill` uses your commit messages as the title and body. To write it yourself:

```bash
gh pr create --title "Engine 1: name normalization" --body "Handles middle names and suffixes as non-conflicts."
```

Review your teammate's PR:

```bash
gh pr list                      # see open PRs
gh pr checkout 3                # check out PR #3 locally to try it
gh pr diff 3                    # read the diff in the terminal
gh pr review 3 --approve
gh pr review 3 --comment -b "Looks good, one question about the tolerance default"
```

Merge it:

```bash
gh pr merge 3 --squash --delete-branch
```

**Use `--squash`.** It collapses the branch into one commit on `main`, which keeps history
readable and makes reverting a whole feature a single command.

> **At hour 20, stop requiring review.** If your teammate is asleep and the demo needs a
> fix, merge your own PR. A blocked fix costs more than an unreviewed one. Agree on this
> in advance so nobody feels stepped on.

---

## Merging and conflicts

### Bring `main` into your branch

Do this **often** — at least every few hours. Conflicts found early are small.

```bash
git checkout main
git pull
git checkout your-branch
git rebase main
```

If a conflict appears, git tells you which files. Open each, look for:

```
<<<<<<< HEAD
their version
=======
your version
>>>>>>> your commit
```

Delete the markers, keep the correct combination, then:

```bash
git add <the-file>
git rebase --continue
```

Bail out entirely if it's going badly:

```bash
git rebase --abort
```

### Prefer merge over rebase if rebasing confuses you

Rebase gives cleaner history; merge is harder to get wrong. **At 4am, take the safe one:**

```bash
git checkout your-branch
git merge main
```

### Conflicts in ontology JSON

Two people adding requirements to the same file conflict constantly. **Avoid it structurally:
one file per requirement group**, not one big file per state:

```
ontology/tx/requirements/background-checks.json
ontology/tx/requirements/home-study.json
ontology/tx/requirements/financial.json
```

New files never conflict. This is worth doing from the first commit.

---

## Checkpoint tags

Per CLAUDE.md principle #5, the app must run end-to-end at every checkpoint. Tag the moments
it does, so you can always get back to something demoable:

```bash
git tag -a checkpoint-h10 -m "Engines 1+2 working on clean family"
git push --tags
```

**At hour 24, freeze:**

```bash
git tag -a demo-freeze -m "Demo freeze — rehearse from here"
git push --tags
```

Get back to a tag if something breaks during rehearsal:

```bash
git checkout demo-freeze
```

List what you've got:

```bash
git tag -l
```

---

## Recovery — when things go wrong

### Undo the last commit, keep the changes

```bash
git reset --soft HEAD~1
```

### Discard uncommitted changes to one file

```bash
git restore path/to/file.ts
```

### Discard *all* uncommitted changes

```bash
git restore .
```

⚠️ This is unrecoverable. Check `git status` first.

### Stash work to switch tasks fast

```bash
git stash push -m "half-done timeline"
git stash list
git stash pop                    # bring it back
```

### You committed a secret (`.env`, API key)

**Rotate the key first.** Assume it's compromised the moment it's pushed — removing it from
history does not un-leak it.

```bash
# rotate the key at the provider FIRST, then:
git rm --cached .env
git commit -m "chore: remove .env from tracking"
git push
```

`.env` is already in [`.gitignore`](../.gitignore), so this shouldn't happen.

### You committed real PII

Hard boundary #3. Same posture as a secret: **the data is out.** Remove it, force-push if
the repo is private and only you two have cloned it, and tell your teammate to re-clone.

```bash
git rm --cached path/to/file
git commit -m "chore: remove non-synthetic data"
git push
```

### `main` is broken and the demo is in an hour

Go back to the last good tag on a new branch, don't try to fix forward:

```bash
git checkout -b demo-recovery demo-freeze
```

### Find a commit you lost

`git reflog` records everything, including commits you reset away:

```bash
git reflog
git checkout <hash-from-reflog>
```

### Undo a merged PR

```bash
git revert -m 1 <merge-commit-hash>
git push
```

### See who changed a line and when

```bash
git log --oneline -20
git blame path/to/file.ts
git log -p path/to/file.ts        # full history of one file
```

---

## Cheat sheet

```bash
# start of every session
git checkout main && git pull

# save work
git add -A && git commit -m "area: what changed" && git push

# new branch
git checkout -b engine/thing

# update branch from main
git checkout main && git pull && git checkout - && git rebase main

# open + merge a PR
gh pr create --fill
gh pr merge --squash --delete-branch

# checkpoint
git tag -a checkpoint-hN -m "what works" && git push --tags

# panic
git stash              # park everything
git reflog             # find what you lost
git rebase --abort     # back out of a bad rebase
git checkout demo-freeze   # back to something that works
```
