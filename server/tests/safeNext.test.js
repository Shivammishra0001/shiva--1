// The sign-in page only ever sends people back to pages on this site (no open redirects).
import { test } from 'node:test'
import assert from 'node:assert/strict'

globalThis.window = { location: { origin: 'https://site.example' } }
const { safeNext } = await import('../../src/member/session.js')

test('safeNext allows same-site pages and rejects everything else', () => {
  assert.equal(safeNext('/community.html?c=ai&tab=feed'), '/community.html?c=ai&tab=feed')
  assert.equal(safeNext('/cohort.html?c=openai'), '/cohort.html?c=openai')
  for (const bad of ['//evil.example/x', 'https://evil.example', 'http://site.example@evil.example', '/\\evil.example', 'javascript:alert(1)', '/admin', '/api/auth/me', '/community.html\r\nSet-Cookie: x=1', '', null, undefined, 42]) {
    assert.equal(safeNext(bad), '/community.html', String(bad))
  }
  assert.equal(safeNext('//evil.example', '/'), '/')
})
