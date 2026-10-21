// "Latest news" for each community and cohort.
// No live news feed is connected, so these are SAMPLE items generated from each page's own topics and labelled
// as such in the UI. Replace newsFor() with a real feed (title, source, date, summary) when one is available.
export const newsFor = (c) => {
  const [a, b, d] = [c.topics[0], c.topics[1] ?? c.topics[0], c.topics[2] ?? c.topics[0]]
  return [
    { id: `${c.id}-n1`, source: 'Sample', title: `Getting started with ${a}`, summary: `A short primer for people new to ${a.toLowerCase()} in ${c.name}.` },
    { id: `${c.id}-n2`, source: 'Sample', title: `${b} in practice: what to watch`, summary: `Practical points the ${c.name} community keeps coming back to.` },
    { id: `${c.id}-n3`, source: 'Sample', title: `Open question: ${d}`, summary: 'A discussion starter for the next community session.' },
  ]
}
