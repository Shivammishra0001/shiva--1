// Market Push project records.
//
// NO VERIFIED PROJECTS YET. The site has no real project records, so the entries below are the sample
// projects already used in the Community area (see seedProjectsFor in communities.js), reused as clearly
// labelled placeholders (`sample: true`). None is marked "market" because none has been verified as
// available to real users. Replace this list with real records; every card, filter and detail view reads it.
//
// status: 'market' (verified available) | 'beta' (prototype / beta) | 'development' (still being built)
// Optional fields (roadmap, screenshots, access, link) are shown only when present.
export const projectStatuses = {
  market: { label: 'Market ready', cta: 'Explore project' },
  beta: { label: 'Prototype / Beta', cta: 'View progress' },
  development: { label: 'Under development', cta: 'View progress' },
}

export const projectFilters = [
  { id: 'all', label: 'All projects' },
  { id: 'market', label: 'Market ready', match: ['market'] },
  { id: 'development', label: 'Under development', match: ['development', 'beta'] },
]

export const projects = [
  {
    slug: 'clinic-notes-copilot', sample: true, name: 'Clinic Notes Copilot', category: 'AI', status: 'beta',
    summary: 'Drafts the medical record while the doctor talks.',
    problem: 'Doctors spend consultation time writing notes instead of talking to patients.',
    solution: 'Listens to the consultation and drafts the record for the doctor to review and edit.',
    features: ['Speech to draft record', 'Doctor reviews and edits before saving', 'Evaluation of draft quality'],
    audience: 'Clinics and doctors',
    stage: 'In an internal beta with a small group of testers.',
    tech: ['Speech', 'LLM', 'Evals'], team: [{ name: 'Arjun Mehta', role: 'Founder, health AI' }],
    availability: 'Not publicly available. Access is limited to beta testers.',
    accent: '#9fd6c0',
    cohorts: ['openai'], owner: { name: 'Arjun Mehta', role: 'Founder, health AI' },
    architecture: [{ name: 'Audio capture', note: 'Records the consultation with the doctor’s consent.' }, { name: 'Speech to text', note: 'Turns the audio into a transcript.' }, { name: 'LLM draft', note: 'A language model drafts the medical record from the transcript.' }, { name: 'Quality evals', note: 'Checks each draft against reference notes before it is shown.' }, { name: 'Doctor review', note: 'The doctor edits and approves before anything is saved.' }],
  },
  {
    slug: 'eval-board', sample: true, name: 'Eval Board', category: 'Developer Tools', status: 'beta',
    summary: 'Compare model results and share what worked.',
    problem: 'Teams run model experiments but have no shared place to compare results.',
    solution: 'A board where results from different runs sit side by side so teams can see what worked.',
    features: ['Side-by-side result comparison', 'Shared notes on what worked'],
    audience: 'Builders running model experiments',
    stage: 'Beta: being tried by community members.',
    tech: ['Evals', 'Agents and tool use'], team: [{ name: 'Priya Nair', role: 'Data Scientist' }],
    availability: 'Not publicly available yet.',
    accent: '#dca3c4',
    cohorts: ['openai', 'huggingface'], owner: { name: 'Priya Nair', role: 'Data Scientist' },
    architecture: [{ name: 'Run results', note: 'Outputs from each model run are collected.' }, { name: 'Eval harness', note: 'The same tests are applied to every run.' }, { name: 'Comparison board', note: 'Results are shown side by side.' }, { name: 'Shared notes', note: 'The team records what worked.' }],
  },
  {
    slug: 'structured-outputs-notebook', sample: true, name: 'Structured Outputs Notebook', category: 'Data Science', status: 'development',
    summary: 'A small tool built around structured outputs.',
    problem: 'Problem statement not yet published by the team.',
    solution: 'Under development. Details will be added by the team.',
    features: [],
    audience: 'Builders working with structured model outputs',
    stage: 'Alpha: early work in progress.',
    tech: ['Structured outputs', 'Agents and tool use', 'Evals'], team: [{ name: 'Arjun Mehta', role: 'Founder, health AI' }],
    availability: 'Not available yet.',
    accent: '#f6dbc0',
    cohorts: ['openai'], owner: { name: 'Arjun Mehta', role: 'Founder, health AI' },
    architecture: [{ name: 'Prompt', note: 'Asks the model for output that follows a schema.' }, { name: 'Model', note: 'Returns structured output.' }, { name: 'Schema validator', note: 'Rejects output that does not match the schema.' }, { name: 'Retry or fallback', note: 'Failures are retried or routed for review.' }, { name: 'Result store', note: 'Valid results are saved for later use.' }],
  },
  {
    slug: 'agent-starter', sample: true, name: 'Agent Starter Kit', category: 'Automation', status: 'development',
    summary: 'A starter kit for agent and tool-use experiments.',
    problem: 'Problem statement not yet published by the team.',
    solution: 'Under development. Details will be added by the team.',
    features: [],
    audience: 'Builders starting with AI agents',
    stage: 'Prototype: first experiments only.',
    tech: ['Agents and tool use', 'Evals', 'Production APIs'], team: [{ name: 'Tomás Rivera', role: 'Full-stack AI Developer' }],
    availability: 'Not available yet.',
    accent: '#b6b0f0',
    cohorts: ['anthropic', 'openai'], owner: { name: 'Tomás Rivera', role: 'Full-stack AI Developer' },
    architecture: [{ name: 'User task', note: 'The request that starts a run.' }, { name: 'Planner', note: 'The model decides which steps to take.' }, { name: 'Tool calls', note: 'Steps call tools and return results.' }, { name: 'Memory', note: 'Keeps state between steps.' }, { name: 'Response', note: 'The final answer is returned with the steps taken.' }],
  },
]

export const categoryIcons = {
  'AI': 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z',
  'Data Science': 'M5 20V12M12 20V5M19 20v-5',
  'Developer Tools': 'M8 8l-5 4 5 4M16 8l5 4-5 4M14 5l-4 14',
  'Automation': 'M13 2L4 14h7l-1 8 9-12h-7z',
}

// ---- cohort pages: projects built with each technology ----
// Explicit records above are tagged with the cohorts they use. Cohorts with fewer than three get sample projects
// generated from their own topics so no cohort page is empty. All are placeholders (sample: true).
const OWNERS = [
  { name: 'Arjun Mehta', role: 'Founder, health AI' },
  { name: 'Tomás Rivera', role: 'Full-stack AI Developer' },
  { name: 'Priya Nair', role: 'Data Scientist' },
]
const generated = (c) => {
  const [a, b, d] = [c.topics[0], c.topics[1], c.topics[2] ?? c.topics[0]]
  const make = (n, name, stage, status, summary, tech, steps) => ({
    slug: `${c.id}-${n}`, sample: true, generated: true, name, category: 'Data Science', status,
    summary, problem: 'Problem statement not yet published by the team.',
    solution: 'Details will be added by the team.', features: [], audience: `Builders working with ${c.name}`,
    stage, tech, team: [OWNERS[n % 3]], owner: OWNERS[n % 3], cohorts: [c.id],
    availability: 'Not publicly available yet.', accent: c.accent,
    architecture: steps.map((name2, i) => ({ name: name2, note: ['Where the work starts.', 'Does the main processing.', 'Checks the result.', 'Delivers the output.'][i] ?? '' })),
  })
  return [
    make(0, `${a} Notebook`, 'Alpha: early work in progress.', 'development', `A small tool built around ${a.toLowerCase()}.`, [a, b, d], ['Input', a, 'Evaluation', 'Output']),
    make(1, `${b} Starter`, 'Prototype: first experiments only.', 'development', `A starter kit for ${b.toLowerCase()} experiments.`, [b, d, c.name], ['Input', b, 'Evaluation', 'Output']),
    make(2, `${c.name} Eval Board`, 'Beta: being tried by community members.', 'beta', 'Compare results and share what worked.', ['Evals', d], ['Run results', 'Eval harness', 'Comparison board']),
  ]
}
export const projectsForCohort = (cohort) => {
  const own = projects.filter((p) => p.cohorts?.includes(cohort.id))
  const taken = new Set(own.map((p) => p.name.toLowerCase()))
  const fill = generated(cohort).filter((p) => !taken.has(p.name.toLowerCase())).slice(0, Math.max(0, 3 - own.length))
  return [...own, ...fill]
}
export const projectBySlug = (cohort, slug) => projectsForCohort(cohort).find((p) => p.slug === slug)
