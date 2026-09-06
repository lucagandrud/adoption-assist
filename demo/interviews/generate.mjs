// Generates demo/interviews/sessions.json from the authored script so every
// agent turn is the script prompt byte for byte. Run from the repo root:
//
//   node demo/interviews/generate.mjs
//
// ALL THREE HOUSEHOLD MEMBERS ARE FICTIONAL (CLAUDE.md hard boundary #3).

import { readFileSync, writeFileSync } from "node:fs";

const script = JSON.parse(readFileSync("extraction/interviews/household-adult.json", "utf8"));
const prompt = (id) => {
  const block = script.blocks.find((b) => b.id === id);
  if (!block) throw new Error(`no block ${id}`);
  return block.prompt;
};

const T0 = Date.parse("2026-09-05T15:00:00Z");
const stamp = (i) => new Date(T0 + i * 45_000).toISOString();

/**
 * answers: [blockId, subjectText, facts[], clarification?]
 * clarification: { question, answer, facts[] } — one bounded follow-up.
 */
function build({ subject_name, subject_role, answers }) {
  const turns = [];
  const facts = [];
  let i = 0;
  const say = (speaker, text) => {
    turns.push({ turn_index: i, speaker, text, started_at: stamp(i), ended_at: stamp(i) });
    return i++;
  };
  for (const [blockId, text, blockFacts, clarification] of answers) {
    say("agent", prompt(blockId));
    const answered = say("subject", text);
    for (const f of blockFacts) facts.push({ ...f, block_id: blockId, turn_index: answered });
    if (clarification) {
      say("agent", clarification.question);
      const again = say("subject", clarification.answer);
      for (const f of clarification.facts) facts.push({ ...f, block_id: blockId, turn_index: again });
      say("agent", "Thank you.");
    } else {
      say("agent", "Thank you.");
    }
  }
  return { subject_name, subject_role, script_id: script.id, status: "complete", turns, facts };
}

const sessions = [
  // A — clean. Every answer populates its facts on the first pass.
  build({
    subject_name: "Marisol Okonkwo-Reyes",
    subject_role: "Prospective caregiver",
    answers: [
      ["household_composition", "There are five of us at home. Me, my husband Teodoro, our daughter Pilar, our son Bastian, and my niece Ines who came to live with us last year.",
        [{ fact_id: "household_size", value: "5", verbatim: "There are five of us at home" },
         { fact_id: "household_members", value: "Teodoro (husband); Pilar (daughter); Bastian (son); Ines (niece)", verbatim: "Me, my husband Teodoro, our daughter Pilar, our son Bastian, and my niece Ines" }]],
      ["adults_in_home", "Just the two adults, me, Marisol Okonkwo-Reyes, and my husband, Teodoro Reyes.",
        [{ fact_id: "adults_in_home", value: "Marisol Okonkwo-Reyes; Teodoro Reyes", verbatim: "me, Marisol Okonkwo-Reyes, and my husband, Teodoro Reyes" }]],
      ["employment", "I'm a pharmacy technician at Cedar Ridge Pharmacy in Plano. I've been there about six years, since the spring of 2020.",
        [{ fact_id: "employment_status", value: "Employed full-time", verbatim: "I'm a pharmacy technician at Cedar Ridge Pharmacy" },
         { fact_id: "employer_name", value: "Cedar Ridge Pharmacy, Plano", verbatim: "Cedar Ridge Pharmacy in Plano" },
         { fact_id: "employment_start", value: "Spring 2020", verbatim: "since the spring of 2020" }]],
      ["residence_history", "We've been at 2210 Larkspur Court in Plano, Texas since 2022. Before that we rented at 480 Mesquite Lane, apartment 3B, also in Plano, from 2019 to 2022.",
        [{ fact_id: "current_address", value: "2210 Larkspur Court, Plano, TX", verbatim: "2210 Larkspur Court in Plano, Texas" },
         { fact_id: "residence_history_5yr", value: "2210 Larkspur Court, Plano, TX (2022–present); 480 Mesquite Lane Apt 3B, Plano, TX (2019–2022)", verbatim: "2210 Larkspur Court in Plano, Texas since 2022. Before that we rented at 480 Mesquite Lane, apartment 3B, also in Plano, from 2019 to 2022" }]],
      ["childcare_plan", "My husband works from home three days a week, and on the other two my mother, who lives ten minutes away, would pick the child up from school.",
        [{ fact_id: "childcare_plan", value: "Husband works from home 3 days/week; subject's mother (10 minutes away) covers the other 2 days after school", verbatim: "My husband works from home three days a week, and on the other two my mother, who lives ten minutes away, would pick the child up from school" }]],
      ["discipline", "We talk it through. We use time-outs for the little ones and losing screen time for the older ones. We don't hit.",
        [{ fact_id: "discipline_approach", value: "Talking it through; time-outs for younger children; loss of screen time for older; no physical discipline", verbatim: "We talk it through. We use time-outs for the little ones and losing screen time for the older ones. We don't hit." }]],
      ["experience_with_children", "I've raised our two, and I've had my niece with us for a year. I also volunteered in the church nursery for about five years.",
        [{ fact_id: "experience_with_children", value: "Raised two children; niece in home for one year; ~5 years volunteering in church nursery", verbatim: "I've raised our two, and I've had my niece with us for a year. I also volunteered in the church nursery for about five years." }]],
      ["references", "Dolores Whitcombe, she's our pastor's wife and has known us twelve years. Raymond Achebe, my supervisor at the pharmacy. And Priya Sundaram, our next-door neighbor.",
        [{ fact_id: "personal_references", value: "Dolores Whitcombe (pastor's wife, 12 years); Raymond Achebe (supervisor); Priya Sundaram (neighbor)", verbatim: "Dolores Whitcombe, she's our pastor's wife and has known us twelve years. Raymond Achebe, my supervisor at the pharmacy. And Priya Sundaram, our next-door neighbor." }]],
      ["additional_statement", "Only that we're ready, and the kids are excited to have their cousin here.",
        [{ fact_id: "additional_statement", value: "Family is ready; children are excited to have their cousin join them", verbatim: "we're ready, and the kids are excited to have their cousin here" }]],
    ],
  }),

  // B — one clarification. The first answer to the employment question
  // does not name an employer; the agent asks once, then moves on.
  build({
    subject_name: "Teodoro Reyes",
    subject_role: "Spouse of prospective caregiver",
    answers: [
      ["household_composition", "Five. My wife Marisol, our kids Pilar and Bastian, and Marisol's niece Ines.",
        [{ fact_id: "household_size", value: "5", verbatim: "Five." },
         { fact_id: "household_members", value: "Marisol (wife); Pilar (daughter); Bastian (son); Ines (niece)", verbatim: "My wife Marisol, our kids Pilar and Bastian, and Marisol's niece Ines" }]],
      ["adults_in_home", "Me, Teodoro Reyes, and Marisol Okonkwo-Reyes.",
        [{ fact_id: "adults_in_home", value: "Teodoro Reyes; Marisol Okonkwo-Reyes", verbatim: "Me, Teodoro Reyes, and Marisol Okonkwo-Reyes" }]],
      ["employment", "I do IT support, mostly remote. Been doing it a long time.",
        [{ fact_id: "employment_status", value: "Employed, IT support, mostly remote", verbatim: "I do IT support, mostly remote" }],
        { question: "Could you tell me the name of the company you work for, and roughly when you started there?",
          answer: "Sorry, yes. Halcyon Systems, out of Dallas. I started in the fall of 2017.",
          facts: [{ fact_id: "employer_name", value: "Halcyon Systems, Dallas", verbatim: "Halcyon Systems, out of Dallas" },
                  { fact_id: "employment_start", value: "Fall 2017", verbatim: "I started in the fall of 2017" }] }],
      ["residence_history", "2210 Larkspur Court, Plano, since 2022. Before that 480 Mesquite Lane, apartment 3B in Plano, 2019 to 2022.",
        [{ fact_id: "current_address", value: "2210 Larkspur Court, Plano, TX", verbatim: "2210 Larkspur Court, Plano" },
         { fact_id: "residence_history_5yr", value: "2210 Larkspur Court, Plano, TX (2022–present); 480 Mesquite Lane Apt 3B, Plano, TX (2019–2022)", verbatim: "2210 Larkspur Court, Plano, since 2022. Before that 480 Mesquite Lane, apartment 3B in Plano, 2019 to 2022" }]],
      ["childcare_plan", "I'm home three days a week. The other days Marisol's mother would help after school.",
        [{ fact_id: "childcare_plan", value: "Subject home 3 days/week; wife's mother helps after school on other days", verbatim: "I'm home three days a week. The other days Marisol's mother would help after school." }]],
      ["discipline", "Calm conversation first. Consequences that fit, like losing a privilege. Never physical.",
        [{ fact_id: "discipline_approach", value: "Calm conversation first; proportionate loss of privileges; no physical discipline", verbatim: "Calm conversation first. Consequences that fit, like losing a privilege. Never physical." }]],
      ["experience_with_children", "Two of my own, plus my niece for the past year. I coach Bastian's soccer team.",
        [{ fact_id: "experience_with_children", value: "Father of two; niece in home one year; coaches youth soccer", verbatim: "Two of my own, plus my niece for the past year. I coach Bastian's soccer team." }]],
      ["references", "Priya Sundaram next door. Coach Luis Ferrante from the soccer league. And Dolores Whitcombe from church.",
        [{ fact_id: "personal_references", value: "Priya Sundaram (neighbor); Luis Ferrante (soccer league); Dolores Whitcombe (church)", verbatim: "Priya Sundaram next door. Coach Luis Ferrante from the soccer league. And Dolores Whitcombe from church." }]],
      ["additional_statement", "No, that's everything.",
        []],
    ],
  }),

  // C — the contradiction. Reports four in the home; the seeded tax return
  // (married filing jointly, 3 dependents) puts five on the return.
  build({
    subject_name: "Ines Okonkwo",
    subject_role: "Adult niece living in the home",
    answers: [
      ["household_composition", "There's four of us. My aunt Marisol, my uncle Teodoro, my cousin Pilar, and me.",
        [{ fact_id: "household_size", value: "4", verbatim: "There's four of us." },
         { fact_id: "household_members", value: "Marisol (aunt); Teodoro (uncle); Pilar (cousin); subject", verbatim: "My aunt Marisol, my uncle Teodoro, my cousin Pilar, and me" }]],
      ["adults_in_home", "My aunt and uncle, Marisol Okonkwo-Reyes and Teodoro Reyes, and me, Ines Okonkwo. I turned eighteen in March.",
        [{ fact_id: "adults_in_home", value: "Marisol Okonkwo-Reyes; Teodoro Reyes; Ines Okonkwo", verbatim: "Marisol Okonkwo-Reyes and Teodoro Reyes, and me, Ines Okonkwo" }]],
      ["employment", "I work part time at the Bluebonnet Grocery on Parker Road, since June.",
        [{ fact_id: "employment_status", value: "Employed part-time", verbatim: "I work part time at the Bluebonnet Grocery" },
         { fact_id: "employer_name", value: "Bluebonnet Grocery, Parker Road", verbatim: "Bluebonnet Grocery on Parker Road" },
         { fact_id: "employment_start", value: "June 2026", verbatim: "since June" }]],
      ["residence_history", "I've been at 2210 Larkspur Court in Plano for about a year. Before that I lived with my mom at 77 Sablewood Drive in Fresno, California.",
        [{ fact_id: "current_address", value: "2210 Larkspur Court, Plano, TX", verbatim: "2210 Larkspur Court in Plano" },
         { fact_id: "residence_history_5yr", value: "2210 Larkspur Court, Plano, TX (~2025–present); 77 Sablewood Drive, Fresno, CA (before 2025)", verbatim: "2210 Larkspur Court in Plano for about a year. Before that I lived with my mom at 77 Sablewood Drive in Fresno, California" }]],
      ["childcare_plan", "I'd help after school when I'm not working. My aunt and uncle have it covered mostly.",
        [{ fact_id: "childcare_plan", value: "Helps after school when not working; aunt and uncle primary", verbatim: "I'd help after school when I'm not working. My aunt and uncle have it covered mostly." }]],
      ["discipline", "I'm not really the one who does that. I'd tell my aunt.",
        [{ fact_id: "discipline_approach", value: "Defers to aunt; not a disciplinarian in the home", verbatim: "I'm not really the one who does that. I'd tell my aunt." }]],
      ["experience_with_children", "I babysit my cousin and I used to help with the kids at my mom's church.",
        [{ fact_id: "experience_with_children", value: "Babysits cousin; helped with children at church", verbatim: "I babysit my cousin and I used to help with the kids at my mom's church." }]],
      ["references", "My manager, Carla Espinoza. My old teacher Mr. Denholm. And our neighbor Priya.",
        [{ fact_id: "personal_references", value: "Carla Espinoza (manager); Mr. Denholm (former teacher); Priya Sundaram (neighbor)", verbatim: "My manager, Carla Espinoza. My old teacher Mr. Denholm. And our neighbor Priya." }]],
      ["additional_statement", "No, nothing else.",
        []],
    ],
  }),
];

writeFileSync(
  "demo/interviews/sessions.json",
  JSON.stringify(
    {
      _README: [
        "GENERATED by demo/interviews/generate.mjs from the authored script. Do not hand-edit.",
        "Three FICTIONAL household members on one case (CLAUDE.md hard boundary #3).",
        "A: clean. B: exactly one clarification. C: household_size = 4, contradicting the",
        "seeded tax return in demo/cases/seed-facts.json (married filing jointly, 3 dependents).",
      ],
      sessions,
    },
    null,
    2,
  ) + "\n",
);
console.log(`wrote ${sessions.length} sessions`);
