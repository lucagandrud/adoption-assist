# Impact model

> **Status: not yet built.** This is the structure and the honesty constraints. The numbers
> in the bracketed parameters are **not filled in** — filling them without sources would
> violate hard boundary #4.

Phase: hours 23–24.

---

## The posture

Three rules govern this document, and they matter more than the final number:

1. **Bottom-up, with every assumption stated.** No top-down "market size" reasoning.
2. **Ranges, not a single number.** Conservative and aggressive scenarios side by side.
3. **Lead with child-days, not dollars.** "X thousand additional child-days in foster care
   per year caused by preventable packet defects" lands harder in this category than a
   dollar figure. Dollars are the secondary number.

---

## The chain

```
  40,000  annual ICPC home study requests          [SOURCED — Sankaran 2014]
×  ~40%   denial rate                              [SOURCED — Sankaran 2014]
= ~16,000 denials per year

× [administratively-defective fraction]            [MUST BE BOUNDED — see below]
= addressable denials

× [additional days in care per denial]             [NEEDS SOURCE]
= excess child-days                                ← THE HEADLINE NUMBER

× [per-child-day cost of foster care]              [NEEDS SOURCE — do not assert]
= taxpayer cost                                    ← the secondary number
```

---

## The line that must be honest

**`[administratively-defective fraction]` is the weak point of this model, and a judge will
find it.**

Many ICPC denials are **substantive** — an unsafe home, a failed background check, a genuine
finding by a licensed social worker. Those denials are correct, they are not addressable by
this system, and **they should not be.** This project checks completeness, consistency,
validity, and sequencing. It never assesses whether a family is fit (hard boundary #1).

So:

- **Do not estimate this fraction.** Bound it, present the bound as a range, and say out
  loud that you are bounding it.
- There is no public corpus of ICPC denial reasons to derive it from. Sankaran had to
  request data from states; 27 responded, with aggregate counts rather than case-level
  reasons. **Say this.** The absence of the data is itself a finding about how this system
  is administered.
- Owning the uncertainty is stronger than papering over it. "We don't know this number and
  neither does anyone else, so here's the range and here's what it does to the total" is a
  better answer than a confident point estimate that falls apart under one question.

---

## Parameters

| Parameter | Conservative | Middle | Aggressive | Source / basis |
|---|---|---|---|---|
| Annual ICPC home study requests | 40,000 | 40,000 | 40,000 | Sankaran (2014) |
| Denial rate | ~40% | ~40% | ~40% | Sankaran (2014) |
| Administratively-defective fraction | *TBD* | *TBD* | *TBD* | **Bounded, not estimated** |
| Additional days in care per denial | *TBD* | *TBD* | *TBD* | **Needs source** |
| Per-child-day foster care cost | *TBD* | *TBD* | *TBD* | **Needs source — do not assert** |

**Secondary lever, separately defensible:** caseworkers spend 4.3 hours of every 8-hour day
on documentation (OPRE, July 2025). Time returned to caseworkers is a real cost reduction
and rests on a federal source rather than on the fraction above. Consider leading the
taxpayer-cost argument here instead — it is the sturdier ground.

---

## Interactive requirement

**Make every parameter adjustable in the UI.** A judge should be able to drag the
administratively-defective fraction down and watch the total move.

> Being able to say *"here is the number if you think our middle assumption is too
> generous"* is worth more than the number itself.

This converts the model's weakest point into a demonstration of intellectual honesty, which
is a better outcome than defending a fixed figure.

---

## Before this ships

- [ ] Source `[additional days in care per denial]` or drop the line and say why
- [ ] Source `[per-child-day cost of foster care]` — federal or state budget documents
- [ ] Write the bounding argument for the addressable fraction in prose, not just a range
- [ ] Add every new source to [`SOURCES.md`](SOURCES.md)
- [ ] Build the parameter sliders
- [ ] Rehearse the answer to: *"How do you know these denials were preventable?"*
      — the honest answer is that we don't know the fraction, and the model shows what
      happens across the whole plausible range
