import { isValidPhoneNumber } from 'react-phone-number-input'

/** Digits only — used to compare two representations of the same number. */
export function phoneDigits(raw?: string | null): string {
  return (raw ?? '').replace(/\D/g, '')
}

/**
 * Supabase Auth (GoTrue) stores phone numbers as E.164 digits WITHOUT the leading
 * '+' (e.g. "4712345678"), and `profiles.phone` mirrors that. `react-phone-number-input`
 * needs the '+'-prefixed E.164 form to display and parse a value.
 *
 * Some users were created outside this system and are stored without a country code —
 * a bare 8-digit Norwegian national number ("12345678"). Prefixing those with '+'
 * produces a wrong number (+1 234-5678), so we leave them untouched.
 */
export function toDisplayPhone(raw?: string | null): string | undefined {
  const trimmed = raw?.trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith('+')) return trimmed
  if (phoneDigits(trimmed).length === 8) return trimmed // bare national number, no country code
  return `+${trimmed}`
}

/** True when a and b are the same number, ignoring '+'/formatting differences. */
export function samePhone(a?: string | null, b?: string | null): boolean {
  return phoneDigits(a) === phoneDigits(b)
}

export { isValidPhoneNumber }
