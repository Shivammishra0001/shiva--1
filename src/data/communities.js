// Demo content for the Community pages. Counts, people, posts, projects and events
// are SAMPLE data (labelled "Demo" in the UI) until a real backend exists.
// Brand names are used only to describe independent builder communities.

export const COMMUNITY_CATEGORIES = ['All', 'Artificial Intelligence', 'AI Governance', 'Quantum', 'Engineering']
export const COMMUNITY_SORTS = [
  { id: 'default', label: 'Featured' },
  { id: 'members', label: 'Most followers' },
  { id: 'name', label: 'A to Z' },
]

const rules = [
  'Be respectful. Disagree with ideas, not people.',
  'No spam or unsolicited promotion.',
  'Share useful technical knowledge: code, results, lessons.',
  'Clearly label promotional or affiliated content.',
  'Respect licences and give attribution.',
]

// Follower baselines are DEMO figures (the UI labels them) until a real backend counts followers.
// Each follow made in a browser adds one on top of the baseline.
const FOLLOWERS = {
  ai: 1840, 'ai-governance': 720, quantum: 640, cloud: 1210,
  openai: 3200, anthropic: 2100, gemini: 1500, huggingface: 2400, sarvam: 880, deepseek: 1700, databricks: 1100, 'neo4j-cohort': 760, nvidia: 1900,
}

// accent hex values come from the site palette
const mk = (o) => ({ rules, createdAt: '2026-03-01', kind: 'company', sample: true, categories: [], followers: FOLLOWERS[o.id] ?? 0, ...o, slug: o.id, mark: o.mark ?? o.name.slice(0, 2).toUpperCase() })
const topic = (o) => mk({ kind: 'topic', sample: false, ...o })

export const communities = [
  topic({ id: 'ai', group: 'Artificial Intelligence', name: 'AI', logo: '/logos/pytorch.svg', tagline: 'Models, agents and real applications', accent: '#f6dbc0', about: 'A space to learn how modern AI works, build with it and share what you find, from language models to agents.', topics: ['Language models', 'Agents', 'Prompting', 'Evaluation', 'Applications'], keywords: ['llm', 'language model', 'prompt', 'agent', 'foundation model', 'machine learning', 'data science'] }),
  topic({ id: 'ai-governance', group: 'AI Governance', name: 'AI Governance', logo: '/logos/scale.svg', tagline: 'Responsible AI, risk and compliance', accent: '#e8a0a0', about: 'For people who want AI to be safe, fair and accountable: policy, risk assessment, documentation and compliance in practice.', topics: ['Responsible AI', 'Risk assessment', 'Model documentation', 'Compliance', 'Ethics'], keywords: ['governance', 'responsible ai', 'ethics', 'compliance', 'risk', 'policy'] }),
  topic({ id: 'quantum', group: 'Quantum', name: 'Quantum Computing', logo: '/logos/qiskit.svg', tagline: 'Qubits, algorithms and what comes next', accent: '#b6b0f0', about: 'A beginner-friendly space to explore quantum computing concepts, tools and early applications.', topics: ['Qubits', 'Quantum algorithms', 'Simulators', 'Quantum ML', 'Learning paths'], keywords: ['quantum', 'qubit'] }),
  topic({ id: 'cloud', group: 'Engineering', name: 'Cloud Computing', logo: '/logos/kubernetes.svg', tagline: 'Deploying and running systems in the cloud', accent: '#b9c8e8', about: 'For people who build and ship on the cloud: containers, pipelines, monitoring, MLOps and the platforms behind them.', topics: ['Deployment', 'Containers', 'MLOps', 'Monitoring', 'Cost'], keywords: ['mlops', 'deploy', 'docker', 'cloud', 'ci/cd', 'pipeline', 'data engineering'] }),
]

export const communityHref = (c, tab) => (c.cohort ? cohortHref(c, tab) : `/community.html?c=${c.slug}${tab && tab !== 'feed' ? `&tab=${tab}` : ''}`)

// ---- cohorts: one learning cohort per AI platform (shown on cohort.html with the same interface) ----
// Logos are the companies' own marks and are used only to name the technology covered. These are independent
// cohorts, not run by or affiliated with those companies. Resource names are plain text: no outbound links.
const cohort = (o) => mk({ cohort: true, kind: 'company', ...o })
export const cohorts = [
  cohort({ id: 'openai', group: 'AI · Developer', name: 'OpenAI', logo: '/logos/ai/openai.svg', accent: '#5fd3b0', tagline: 'Agents & API builders',
    keywords: ['llm', 'agent', 'prompt', 'rag', 'structured'], topics: ['Structured outputs', 'Agents and tool use', 'Evals', 'Production APIs'],
    about: 'For people exploring LLM applications, agents, APIs and practical AI product development.',
    officialWebsite: 'https://openai.com', docs: 'https://platform.openai.com/docs', github: 'https://github.com/openai' }),
  cohort({ id: 'anthropic', group: 'AI · Developer', name: 'Anthropic', logo: '/logos/ai/anthropic.svg', accent: '#e8a07f', tagline: 'Claude, agents & responsible AI',
    keywords: ['llm', 'agent', 'governance', 'responsible ai', 'ethics'], topics: ['Prompting Claude', 'Tool use and agents', 'Responsible AI', 'Evaluating model output'],
    about: 'A cohort for building with Claude, designing reliable agents and applying responsible AI practice.',
    officialWebsite: 'https://www.anthropic.com', docs: 'https://docs.anthropic.com', github: 'https://github.com/anthropics' }),
  cohort({ id: 'gemini', group: 'AI · Developer', name: 'Gemini', logo: '/logos/ai/gemini.svg', accent: '#a9b8ff', tagline: 'Multimodal models & apps',
    keywords: ['foundation model', 'llm', 'multimodal'], topics: ['Multimodal prompts', 'Long-context apps', 'Grounding', 'Model evaluation'],
    about: 'For builders working with multimodal models: text, images and long documents in one application.',
    officialWebsite: 'https://gemini.google.com', docs: 'https://ai.google.dev/gemini-api/docs', github: 'https://github.com/google-gemini' }),
  cohort({ id: 'huggingface', group: 'AI · Open source', name: 'Hugging Face', logo: '/logos/ai/huggingface.svg', accent: '#f6c945', tagline: 'Open models, datasets & Transformers',
    keywords: ['foundation model', 'transformer', 'fine-tuning', 'pretraining', 'pytorch'], topics: ['Transformers', 'Fine-tuning', 'Datasets', 'Model sharing'],
    about: 'A cohort on open models: find them, run them, fine-tune them and share what you build.',
    officialWebsite: 'https://huggingface.co', docs: 'https://huggingface.co/docs', github: 'https://github.com/huggingface' }),
  cohort({ id: 'sarvam', group: 'AI · India', name: 'Sarvam AI', logo: '/logos/ai/sarvam.svg', accent: '#dca3c4', tagline: 'AI for Indian languages',
    keywords: ['foundation model', 'llm', 'indic'], topics: ['Indic language models', 'Speech and voice', 'Tokenisation', 'Building for India'],
    about: 'For people building AI products for India: Indian languages, speech and voice, and local context.',
    officialWebsite: 'https://www.sarvam.ai', docs: 'https://docs.sarvam.ai', github: 'https://github.com/sarvamai' }),
  cohort({ id: 'deepseek', group: 'AI · Open models', name: 'DeepSeek', logo: '/logos/ai/deepseek.svg', accent: '#9db0ff', tagline: 'Open reasoning models & research',
    keywords: ['foundation model', 'pretraining', 'research'], topics: ['Reasoning models', 'Pretraining basics', 'Reading research papers', 'Running open weights'],
    about: 'A study group for open reasoning models: how they are trained, evaluated and run in practice.',
    officialWebsite: 'https://www.deepseek.com', docs: 'https://api-docs.deepseek.com', github: 'https://github.com/deepseek-ai' }),
  cohort({ id: 'databricks', group: 'Data · Engineering', name: 'Databricks', logo: '/logos/ai/databricks.svg', accent: '#ff7f6b', tagline: 'Lakehouse, pipelines & ML at scale',
    keywords: ['mlops', 'data engineering', 'pipeline', 'ml systems'], topics: ['Lakehouse basics', 'Data pipelines', 'MLOps', 'Model serving'],
    about: 'For data and ML engineers building pipelines and taking models from notebook to production.',
    officialWebsite: 'https://www.databricks.com', docs: 'https://docs.databricks.com', github: 'https://github.com/databricks' }),
  cohort({ id: 'neo4j-cohort', group: 'Data · Graphs', name: 'Neo4j', logo: '/logos/ai/neo4j.svg', accent: '#6fc2b8', tagline: 'Graphs & GraphRAG',
    keywords: ['neo4j', 'graph', 'knowledge graph'], topics: ['Graph modelling', 'Cypher', 'Knowledge graphs', 'GraphRAG'],
    about: 'For people working with graph databases, knowledge graphs and GraphRAG.',
    officialWebsite: 'https://neo4j.com', docs: 'https://neo4j.com/docs', github: 'https://github.com/neo4j' }),
  cohort({ id: 'nvidia', group: 'AI · Compute', name: 'NVIDIA', logo: '/logos/ai/nvidia.svg', accent: '#8fd14f', tagline: 'GPUs, CUDA & accelerated AI',
    keywords: ['mlops', 'deep learning', 'pytorch', 'gpu', 'deployment'], topics: ['GPU basics', 'CUDA and PyTorch', 'Training at scale', 'Inference and deployment'],
    about: 'For people who train and serve models on GPUs and want to understand the hardware behind them.',
    officialWebsite: 'https://www.nvidia.com', docs: 'https://developer.nvidia.com', github: 'https://github.com/NVIDIA' }),
]
export const cohortHref = (c, tab) => `/cohort.html?c=${c.slug}${tab && tab !== 'feed' ? `&tab=${tab}` : ''}`


// ---- sample people (fictional) ----
export const members = [
  { id: 'm-karthik', name: 'Karthik Subramanian', role: 'Community host', accent: '#f6dbc0', isModerator: true, skills: ['Community', 'LLM apps'], projectsCount: 4 },
  { id: 'm-priya', name: 'Priya Nair', role: 'Data Scientist', accent: '#dca3c4', skills: ['Python', 'Evals'], projectsCount: 3 },
  { id: 'm-tomas', name: 'Tomás Rivera', role: 'Full-stack AI Developer', accent: '#b6b0f0', skills: ['TypeScript', 'Agents'], projectsCount: 5 },
  { id: 'm-sara', name: 'Sara Khan', role: 'Product Builder', accent: '#9fd6c0', skills: ['Product', 'RAG'], projectsCount: 2 },
  { id: 'm-arjun', name: 'Arjun Mehta', role: 'Founder, health AI', accent: '#e9a98a', skills: ['Speech', 'Healthcare'], projectsCount: 1 },
  { id: 'm-meera', name: 'Meera Iyer', role: 'ML Engineer', accent: '#c9a0e0', skills: ['PyTorch', 'MLOps'], projectsCount: 3 },
]
export const memberById = (id) => members.find((m) => m.id === id)

// ---- seed content, generated per community ----
const ago = (minutes) => new Date(Date.now() - minutes * 60000).toISOString()

export function seedPostsFor(c) {
  if (c.kind !== 'company') return []
  const p = (n, o) => ({ id: `${c.id}-p${n}`, communityId: c.id, likes: 0, ...o })
  if (c.id === 'openai') {
    return [
      p(1, { authorId: 'm-karthik', type: 'announcement', pinned: true, createdAt: ago(60 * 72), likes: 58, content: 'Welcome to OpenAI Builders\n\nShare what you’re building, ask the questions you’re stuck on, and post results, including the ones that didn’t work. Office hours are every Thursday; the next show & tell is on the Events tab.', tags: ['Welcome'] }),
      p(2, { authorId: 'm-priya', createdAt: ago(120), likes: 42, content: 'I’ve been testing structured outputs for an internal data extraction workflow. The biggest improvement wasn’t the model change. It was tightening the schema and making failure cases explicit.\n\nCurious how others are handling retries and validation in production.', tags: ['OpenAI', 'LLM', 'StructuredOutput'] }),
      p(3, { authorId: 'm-tomas', type: 'question', createdAt: ago(300), likes: 17, content: 'Has anyone built a reliable agent workflow where tool calls can be inspected and replayed without re-running the entire conversation?', tags: ['Agents', 'Debugging'] }),
      p(4, { authorId: 'm-sara', createdAt: ago(540), likes: 33, content: 'Here’s the architecture diagram we are currently testing. The validator sits between the model and the queue, so bad JSON never reaches downstream services.', tags: ['Architecture', 'Extraction'], images: [{ alt: 'Pipeline: Upload, Model, Validator, Queue, Review UI, with a retry loop from Validator back to Model', figure: { kind: 'architecture', nodes: ['Upload', 'Model', 'Validator', 'Queue', 'Review UI'], loopBack: [2, 1], loopLabel: 'retry' } }] }),
      p(5, { authorId: 'm-arjun', type: 'project', createdAt: ago(1440), likes: 61, content: 'We just moved our first prototype into an internal beta. Four clinics, one week in. The biggest surprise: doctors edit the summary less when it’s shorter.', tags: ['ProjectUpdate', 'HealthAI'], project: { name: 'Clinic Notes Copilot', stage: 'Beta', description: 'Drafts the medical record while the doctor talks.', tech: ['Speech', 'LLM', 'Evals'] } }),
    ]
  }
  return [
    p(1, { authorId: 'm-karthik', type: 'announcement', pinned: true, createdAt: ago(60 * 70), likes: 34, content: `Welcome to ${c.name} Builders\n\nShare what you’re building, ask what you’re stuck on, and post results, including the ones that didn’t work.`, tags: ['Welcome'] }),
    p(2, { authorId: 'm-meera', createdAt: ago(150), likes: 21, content: `Spent the week on ${c.topics[0]} for a small internal project. The surprise: the setup took longer than the actual model work.\n\nWhat’s your go-to checklist before you start?`, tags: [c.name.replace(/\s/g, ''), c.topics[0].replace(/\s/g, '')] }),
    p(3, { authorId: 'm-tomas', type: 'question', createdAt: ago(380), likes: 12, content: `Looking for good learning resources on ${c.topics[1]}. What helped you most when you started?`, tags: [c.topics[1].replace(/\s/g, '')] }),
    p(4, { authorId: 'm-sara', type: 'poll', createdAt: ago(700), likes: 9, content: `What are you focusing on in ${c.name} this month?`, poll: { options: c.topics.slice(0, 4).map((t, i) => ({ id: `o${i}`, label: t, votes: [14, 9, 6, 4][i] })) } }),
    p(5, { authorId: 'm-arjun', type: 'project', createdAt: ago(1700), likes: 27, content: 'First working demo is live for a few testers. Feedback welcome, especially on the onboarding flow.', tags: ['ProjectUpdate'], project: { name: `${c.topics[0]} Notebook`, stage: 'Alpha', description: `A small tool built around ${c.topics[0].toLowerCase()}.`, tech: c.topics.slice(0, 3) } }),
  ]
}

export function seedCommentsFor(c) {
  if (c.kind !== 'company') return []
  const id = (n) => `${c.id}-c${n}`
  return [
    { id: id(1), postId: `${c.id}-p2`, authorId: 'm-tomas', content: 'We do the same: explicit failure cases first, then tighten from there.', createdAt: ago(100), parentId: null },
    { id: id(2), postId: `${c.id}-p2`, authorId: 'm-priya', content: 'Agreed. Logging every failure made the next fix obvious.', createdAt: ago(90), parentId: id(1) },
    { id: id(3), postId: `${c.id}-p2`, authorId: 'm-sara', content: 'Would love to see your schema if you can share a redacted version.', createdAt: ago(70), parentId: null },
    { id: id(4), postId: `${c.id}-p3`, authorId: 'm-meera', content: 'Start with the official docs, then pick one small project and finish it.', createdAt: ago(240), parentId: null },
  ]
}

export function seedProjectsFor(c) {
  if (c.kind !== 'company') return []
  return [
    { id: `${c.id}-pr1`, communityId: c.id, name: `${c.topics[0]} Notebook`, stage: 'Alpha', description: `A small tool built around ${c.topics[0].toLowerCase()}.`, tech: c.topics.slice(0, 3), builder: 'm-arjun' },
    { id: `${c.id}-pr2`, communityId: c.id, name: `${c.topics[1]} Starter`, stage: 'Prototype', description: `A starter kit for ${c.topics[1].toLowerCase()} experiments.`, tech: c.topics.slice(1, 4), builder: 'm-tomas' },
    { id: `${c.id}-pr3`, communityId: c.id, name: `${c.name} Eval Board`, stage: 'Beta', description: 'Compare results and share what worked.', tech: ['Evals', c.topics[2]], builder: 'm-priya' },
  ]
}
