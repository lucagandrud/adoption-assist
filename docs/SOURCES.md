# Sources

Every statistic used in this project and in its presentation appears below. Nothing is cited
from memory.

## Statistics

| Fact | Value | Source |
|---|---|---|
| Annual ICPC home study requests | ~40,000 | Sankaran, *Child Law Practice* 33(6), American Bar Association (2014), drawing on an Annie E. Casey Foundation study with 27 states responding |
| Denial rate for placement requests | ~40% | Sankaran (2014) |
| Tennessee denial rates, 6-year average | 35% overall; 58% for parents; 46.4% for relatives | Sankaran (2014) |
| Decision window | Final approval or denial no later than 180 calendar days from receipt of the initial home study request | ICPC Regulations, Association of Administrators of the ICPC |
| Right of appeal | None. The remedy is a request for review or a new ICPC request | American Bar Association, Section of Litigation, Children's Rights Committee |
| Caseworker documentation burden | 4.3 hours per 8-hour day | Office of Planning, Research, and Evaluation (federal), published July 2025, data collected 2021–2022 |
| Children in foster care, FY2024 | 328,947 | AFCARS FY2024 |
| Legally free with an adoption permanency plan, still in care | 34,817 | AFCARS FY2024 |
| Adoptions from foster care, FY2024 | 46,935, the lowest since 1999 | AFCARS FY2024 |
| Universal NEICE participation deadline | 2027 | Family First Prevention Services Act of 2018 |

## Regulatory sources for requirement data

Requirements are encoded per jurisdiction from published regulatory text:

- **AAICPC** for the ICPC regulations and the ICPC-100A and 100B forms
- **California CDSS** for Resource Family Approval written directives and all-county letters
- **Texas DFPS** for home screening and licensing standards, and the Texas Administrative
  Code chapters they implement

State statute summaries from the federal Child Welfare Information Gateway were used for
orientation only. Citations point at the underlying state document.

## How citations are enforced

Every requirement and document in the ontology carries a `source_citation` and a `verified`
flag. The flag is not decorative: an entry authored without a confirmed source is
`verified: false`, and the interface renders it with an "Unverified" badge next to the
requirement rather than presenting it as settled regulation.

An unverified requirement is a known gap. A fabricated citation would be a false statement
about the law, so where a source could not be confirmed the entry says so.
