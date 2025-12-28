export function sanitizeDigits(value: string, maxLength?: number) {
  const digits = value.replace(/\D/g, '');
  if (typeof maxLength === 'number') {
    return digits.slice(0, maxLength);
  }
  return digits;
}

export function isValidSiret(value: string) {
  const digits = sanitizeDigits(value, 14);
  if (digits.length !== 14) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    const digit = Number(digits[digits.length - 1 - i]);
    if (Number.isNaN(digit)) {
      return false;
    }
    if (i % 2 === 1) {
      const doubled = digit * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    } else {
      sum += digit;
    }
  }

  return sum % 10 === 0;
}
