/**
 * Phone handling for the SMS consent log.
 *
 * Deliberately narrow: North American numbers only, because that's who the
 * campaign covers and because a half-right international parser is worse
 * than an honest rejection — a number stored in the wrong shape can't be
 * matched to an opt-out later, which is the one thing this must never get
 * wrong.
 */

/** "+1XXXXXXXXXX", or null if it isn't a number we can store with confidence. */
export function toE164(input: string): string | null {
  const digits = input.replace(/\D/g, "");

  // 10 digits: a bare US/Canada number.
  if (digits.length === 10) {
    return isValidNanp(digits) ? `+1${digits}` : null;
  }
  // 11 digits starting with the country code.
  if (digits.length === 11 && digits.startsWith("1")) {
    const rest = digits.slice(1);
    return isValidNanp(rest) ? `+1${rest}` : null;
  }
  return null;
}

/**
 * North American Numbering Plan rules, which rule out most typos and every
 * fake number people reach for. Area code and exchange both have to start
 * 2-9, and 555-01xx is the reserved fictional range.
 */
function isValidNanp(ten: string): boolean {
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(ten)) return false;
  if (/^\d{3}55501\d{2}$/.test(ten)) return false;
  return true;
}

/** "+15551234567" -> "(555) 123-4567", for showing a number back to someone. */
export function formatE164(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

/** "+15551234567" -> "(•••) •••-4567". For admin screens, where knowing
 *  *which* number opted in matters but printing it in full doesn't. */
export function maskE164(e164: string): string {
  const m = /^\+1\d{6}(\d{4})$/.exec(e164);
  return m ? `(•••) •••-${m[1]}` : "••••";
}
