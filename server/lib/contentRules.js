// First-pass content screening. This is a small, configurable rules layer, NOT a reliable detector of harmful content.
// It can only hold something for a person to review (or, for a few severe patterns, hide it pending review).
// It never deletes, suspends or contacts anyone. Technical and security discussion is not flagged on its own: the
// patterns below look for directed threats, scam wording and link abuse, not for sensitive topics.
// Edit RULES to tune it. Anything ambiguous should go to the moderation queue, not be auto-decided.
const URL_RE = /\bhttps?:\/\/[^\s)]+/gi
const SHORTENERS = /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|cutt\.ly|rb\.gy)\//i

export const RULES = [
  { id: 'many_links', reason: 'spam', severity: 'review', detail: 'Contains many links.', test: (t) => (t.match(URL_RE) ?? []).length > 3 },
  { id: 'url_shortener', reason: 'malicious', severity: 'review', detail: 'Contains a shortened link.', test: (t) => SHORTENERS.test(t) },
  { id: 'phishing_wording', reason: 'malicious', severity: 'review', detail: 'Looks like account-verification wording next to a link.', test: (t) => /https?:\/\//i.test(t) && /(verify|confirm|update|unlock|restore).{0,40}(account|password|wallet|bank|kyc)/i.test(t) },
  { id: 'credential_request', reason: 'malicious', severity: 'review', detail: 'Asks for a password, OTP or seed phrase.', test: (t) => /(send|share|give|tell)\s+(me|us)\s+(your|ur)\s+(password|otp|pin|seed phrase|private key)/i.test(t) },
  { id: 'scam_wording', reason: 'spam', severity: 'review', detail: 'Matches common scam wording.', test: (t) => /(guaranteed\s+(returns|profit)|double your (money|crypto|investment)|earn \$?\d+[k,]*\s*(a|per)\s*(day|week) from home)/i.test(t) },
  { id: 'private_identifier', reason: 'privacy', severity: 'review', detail: 'May contain a personal identifier or home address.', test: (t) => (/\b\d{4}\s?\d{4}\s?\d{4}\b/.test(t) && /aadhaar|aadhar|uid|ssn|passport/i.test(t)) || /\b(lives at|home address|his address|her address)\b/i.test(t) },
  { id: 'directed_threat', reason: 'threat', severity: 'severe', detail: 'Reads like a direct threat of violence.', test: (t) => /\b(i('?m| am)?\s*(going to|gonna)|i will|i'?ll|we will|we'?ll)\s+(kill|murder|shoot|stab|hurt|rape|burn down)\s+(you|u|him|her|them|your (family|house|kids?))\b/i.test(t) },
  { id: 'minor_sexual_content', reason: 'sexual_exploitation', severity: 'severe', detail: 'Mentions sexual content involving minors.', test: (t) => /\b(child|children|minor|underage|kid)s?\b.{0,40}\b(porn|nude|nudes|sexual|sex)\b/i.test(t) },
]

// verdict: 'published' | 'pending_review' (held for a person) | 'restricted' (hidden pending urgent review)
export function screenContent(text, rules = RULES) {
  const flags = []
  for (const r of rules) { URL_RE.lastIndex = 0; if (r.test(text)) flags.push({ rule: r.id, reason: r.reason, severity: r.severity, detail: r.detail }) }
  const verdict = flags.some((f) => f.severity === 'severe') ? 'restricted' : flags.length ? 'pending_review' : 'published'
  return { verdict, flags }
}

// Limits, control characters and link rules shared by posts, comments and bios.
export function cleanText(input, { max }) {
  const text = String(input ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n/g, '\n').trim()
  return text.length > max ? null : text
}
export const safeLink = (value) => {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && value.length <= 300 && !u.username && !u.password ? u.toString() : null } catch { return null }
}
