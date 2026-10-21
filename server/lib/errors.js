// One error type for every expected failure; anything else is reported as a generic 500.
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}
export const badRequest = (message, details) => new HttpError(400, 'bad_request', message, details)
export const unauthorized = (message = 'Sign in to continue.') => new HttpError(401, 'unauthorized', message)
export const forbidden = (message = 'You do not have permission to do that.', code = 'forbidden') => new HttpError(403, code, message)
export const notFound = (message = 'Not found.') => new HttpError(404, 'not_found', message)
export const conflict = (message, details) => new HttpError(409, 'conflict', message, details)
export const tooMany = (message = 'Too many attempts. Try again later.', retryAfterSec) => {
  const e = new HttpError(429, 'rate_limited', message)
  if (retryAfterSec) e.headers = { 'Retry-After': String(retryAfterSec) }
  return e
}
