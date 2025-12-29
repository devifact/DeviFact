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

export type PhoneValidationResult = {
  isValid: boolean;
  normalized: string;
  reason?: 'empty' | 'format' | 'sequence';
};

export function normalizePhoneInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const cleaned = trimmed.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    return `+${cleaned.slice(1).replace(/\+/g, '')}`;
  }
  return cleaned.replace(/\+/g, '');
}

function isSimpleSequence(value: string) {
  if (!value) {
    return true;
  }

  const uniqueDigits = new Set(value);
  if (uniqueDigits.size === 1) {
    return true;
  }

  const sequences = ['0123456789', '1234567890', '9876543210', '0987654321'];
  return sequences.includes(value);
}

export function validateFrenchPhone(value: string): PhoneValidationResult {
  const normalized = normalizePhoneInput(value);
  if (!normalized) {
    return { isValid: false, normalized, reason: 'empty' };
  }

  let digitsForCheck = '';
  if (normalized.startsWith('+')) {
    if (!normalized.startsWith('+33')) {
      return { isValid: false, normalized, reason: 'format' };
    }
    const national = normalized.slice(3);
    if (!/^[1-9]\d{8}$/.test(national)) {
      return { isValid: false, normalized, reason: 'format' };
    }
    digitsForCheck = `0${national}`;
  } else {
    if (!/^0[1-9]\d{8}$/.test(normalized)) {
      return { isValid: false, normalized, reason: 'format' };
    }
    digitsForCheck = normalized;
  }

  if (isSimpleSequence(digitsForCheck)) {
    return { isValid: false, normalized, reason: 'sequence' };
  }

  return { isValid: true, normalized };
}
