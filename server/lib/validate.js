// Small input validator. Unknown fields are dropped, which blocks mass assignment.
//   const clean = validate(body, { name: str({ min: 2, max: 80 }), age: int({ min: 0 }) })
import { badRequest } from './errors.js'

const opt = (o) => o.optional === true
export const str = (o = {}) => ({ type: 'str', min: 0, max: 5000, trim: true, ...o })
export const int = (o = {}) => ({ type: 'int', ...o })
export const bool = (o = {}) => ({ type: 'bool', ...o })
export const oneOf = (values, o = {}) => ({ type: 'enum', values, ...o })
export const list = (item, o = {}) => ({ type: 'list', item, max: 50, ...o })
export const date = (o = {}) => ({ type: 'date', ...o })
export const email = (o = {}) => ({ type: 'email', ...o })
export const obj = (shape, o = {}) => ({ type: 'obj', shape, ...o })

function check(key, spec, value, errors) {
  if (value === undefined || value === null || value === '') {
    if (opt(spec) || spec.nullable) return spec.nullable && value === null ? null : undefined
    errors[key] = 'Required.'
    return undefined
  }
  switch (spec.type) {
    case 'str': {
      if (typeof value !== 'string') return void (errors[key] = 'Must be text.')
      const v = spec.trim ? value.trim() : value
      if (v.length < spec.min) return void (errors[key] = `At least ${spec.min} characters.`)
      if (v.length > spec.max) return void (errors[key] = `At most ${spec.max} characters.`)
      if (spec.pattern && !spec.pattern.test(v)) return void (errors[key] = spec.patternMessage || 'Invalid format.')
      return v
    }
    case 'email': {
      const v = typeof value === 'string' ? value.trim().toLowerCase() : ''
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || v.length > 254) return void (errors[key] = 'Enter a valid email address.')
      return v
    }
    case 'int': {
      const n = Number(value)
      if (!Number.isInteger(n)) return void (errors[key] = 'Must be a whole number.')
      if (spec.min !== undefined && n < spec.min) return void (errors[key] = `At least ${spec.min}.`)
      if (spec.max !== undefined && n > spec.max) return void (errors[key] = `At most ${spec.max}.`)
      return n
    }
    case 'bool':
      if (typeof value !== 'boolean') return void (errors[key] = 'Must be true or false.')
      return value
    case 'enum':
      if (!spec.values.includes(value)) return void (errors[key] = `Must be one of: ${spec.values.join(', ')}.`)
      return value
    case 'date': {
      const t = Date.parse(value)
      if (typeof value !== 'string' || Number.isNaN(t)) return void (errors[key] = 'Enter a valid date and time.')
      return new Date(t).toISOString()
    }
    case 'list': {
      if (!Array.isArray(value)) return void (errors[key] = 'Must be a list.')
      if (value.length > spec.max) return void (errors[key] = `At most ${spec.max} items.`)
      const out = []
      value.forEach((item, i) => { const v = check(`${key}[${i}]`, { ...spec.item, optional: false }, item, errors); if (v !== undefined) out.push(v) })
      return out
    }
    case 'obj': {
      if (typeof value !== 'object' || Array.isArray(value)) return void (errors[key] = 'Invalid value.')
      const sub = {}
      const out = {}
      for (const [k, sp] of Object.entries(spec.shape)) { const v = check(`${key}.${k}`, sp, value[k], sub); if (v !== undefined) out[k] = v }
      Object.assign(errors, sub)
      return out
    }
    default:
      return undefined
  }
}

export function validate(body, schema, { partial = false } = {}) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Send a JSON object.')
  const errors = {}
  const out = {}
  for (const [key, spec] of Object.entries(schema)) {
    if (partial && !(key in body)) continue
    const v = check(key, spec, body[key], errors)
    if (v !== undefined || (spec.nullable && body[key] === null)) out[key] = v
  }
  if (Object.keys(errors).length) throw badRequest('Check the highlighted fields.', errors)
  return out
}
