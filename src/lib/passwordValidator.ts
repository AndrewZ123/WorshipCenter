// Password strength validation and utilities
// Helps users create strong, secure passwords

export interface PasswordValidationResult {
  valid: boolean;
  score: number; // 0-4
  strength: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  feedback: string[];
  suggestions: string[];
}

export interface PasswordRequirements {
  minLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
  preventCommonPasswords?: boolean;
  preventPersonalInfo?: boolean;
}

const defaultRequirements: PasswordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventPersonalInfo: true,
};

// List of common weak passwords to prevent
const commonPasswords = [
  'password',
  '123456',
  '12345678',
  'qwerty',
  'abc123',
  'letmein',
  'monkey',
  'dragon',
  '111111',
  'baseball',
  'iloveyou',
  'trustno1',
  'sunshine',
  'princess',
  'admin',
  'welcome',
  'shadow',
  'ashley',
  'football',
  'jesus',
  'michael',
  'ninja',
  'mustang',
  'password1',
];

// Special characters that count for strength
const specialChars = '!@#$%^&*()_+-=[]{}|;:\'",.<>?`~';

/**
 * Validate password strength and provide feedback
 */
export function validatePassword(
  password: string,
  requirements: PasswordRequirements = defaultRequirements,
  userInfo?: {
    email?: string;
    name?: string;
  }
): PasswordValidationResult {
  const feedback: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Check minimum length
  const minLength = requirements.minLength || 8;
  if (password.length < minLength) {
    feedback.push(`Password must be at least ${minLength} characters long`);
    suggestions.push(`Add more characters to reach ${minLength} characters`);
  } else {
    score += password.length >= 12 ? 2 : 1;
  }

  // Check for uppercase letters
  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    feedback.push('Password must contain at least one uppercase letter');
    suggestions.push('Add uppercase letters (A-Z)');
  } else if (/[A-Z]/.test(password)) {
    score += 1;
  }

  // Check for lowercase letters
  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    feedback.push('Password must contain at least one lowercase letter');
    suggestions.push('Add lowercase letters (a-z)');
  } else if (/[a-z]/.test(password)) {
    score += 1;
  }

  // Check for numbers
  if (requirements.requireNumbers && !/\d/.test(password)) {
    feedback.push('Password must contain at least one number');
    suggestions.push('Add numbers (0-9)');
  } else if (/\d/.test(password)) {
    score += 1;
  }

  // Check for special characters
  if (requirements.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{}|;:\'",.<>?`~]/.test(password)) {
    feedback.push('Password must contain at least one special character');
    suggestions.push('Add special characters (!@#$%^&*...)');
  } else if (/[!@#$%^&*()_+\-=\[\]{}|;:\'",.<>?`~]/.test(password)) {
    score += 1;
  }

  // Check for common passwords
  if (requirements.preventCommonPasswords) {
    const lowerPassword = password.toLowerCase();
    if (commonPasswords.some((common) => lowerPassword.includes(common))) {
      feedback.push('Password is too common and easily guessable');
      suggestions.push('Avoid using common words or patterns');
      score = Math.max(0, score - 2);
    }
  }

  // Check for personal information
  if (requirements.preventPersonalInfo && userInfo) {
    if (userInfo.email && password.toLowerCase().includes(userInfo.email.split('@')[0])) {
      feedback.push('Password should not contain parts of your email');
      suggestions.push('Avoid using personal information in your password');
      score = Math.max(0, score - 1);
    }

    if (userInfo.name) {
      const nameParts = userInfo.name.toLowerCase().split(/\s+/);
      if (nameParts.some((part) => part && password.toLowerCase().includes(part))) {
        feedback.push('Password should not contain your name');
        suggestions.push('Avoid using personal information in your password');
        score = Math.max(0, score - 1);
      }
    }
  }

  // Additional strength checks
  if (!/(.)\1{2,}/.test(password)) {
    // No repeated characters (3+ times in a row)
    score += 1;
  } else {
    suggestions.push('Avoid repeating characters');
  }

  if (!/(012|123|234|345|456|567|678|789|890|987|876|765|654|543|432|321|210|qwe|wer|ert|rty|tyu|yui|uio|iop|asd|sdf|dfg|fgh|ghj|hjk|jkl|zxc|xcv|cvb|vbn|bnm)/i.test(password)) {
    // No sequential patterns
    score += 1;
  } else {
    suggestions.push('Avoid sequential patterns (123, abc, etc.)');
  }

  // Calculate final score (0-4)
  score = Math.min(4, Math.max(0, score));

  const valid = feedback.length === 0;
  const strength = getStrengthLabel(score);

  return {
    valid,
    score,
    strength,
    feedback,
    suggestions,
  };
}

/**
 * Get strength label based on score
 */
function getStrengthLabel(score: number): PasswordValidationResult['strength'] {
  if (score === 0) return 'Very Weak';
  if (score === 1) return 'Weak';
  if (score === 2) return 'Fair';
  if (score === 3) return 'Strong';
  return 'Very Strong';
}

/**
 * Get color for strength indicator
 */
export function getStrengthColor(score: number): string {
  if (score === 0) return '#e53e3e'; // red
  if (score === 1) return '#dd6b20'; // orange
  if (score === 2) return '#ecc94b'; // yellow
  if (score === 3) return '#48bb78'; // green
  return '#38a169'; // dark green
}

/**
 * Get width percentage for strength bar
 */
export function getStrengthWidth(score: number): string {
  return `${(score + 1) * 20}%`;
}

/**
 * Check if password meets minimum requirements
 */
export function meetsMinimumRequirements(
  password: string,
  requirements: PasswordRequirements = defaultRequirements
): boolean {
  const minLength = requirements.minLength || 8;
  if (password.length < minLength) return false;
  if (requirements.requireUppercase && !/[A-Z]/.test(password)) return false;
  if (requirements.requireLowercase && !/[a-z]/.test(password)) return false;
  if (requirements.requireNumbers && !/\d/.test(password)) return false;
  if (requirements.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{}|;:\'",.<>?`~]/.test(password)) {
    return false;
  }
  return true;
}

/**
 * Generate a strong random password
 */
export function generateStrongPassword(options: {
  length?: number;
  includeUppercase?: boolean;
  includeLowercase?: boolean;
  includeNumbers?: boolean;
  includeSpecialChars?: boolean;
  excludeAmbiguous?: boolean;
} = {}): string {
  const {
    length = 16,
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSpecialChars = true,
    excludeAmbiguous = true,
  } = options;

  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Removed I, O if excludeAmbiguous
  const lowercase = 'abcdefghjkmnpqrstuvwxyz'; // Removed i, l, o if excludeAmbiguous
  const numbers = '23456789'; // Removed 0, 1 if excludeAmbiguous
  const specialChars = '!@#$%^&*()_+-=';

  let chars = '';
  if (includeUppercase) chars += uppercase;
  if (includeLowercase) chars += lowercase;
  if (includeNumbers) chars += numbers;
  if (includeSpecialChars) chars += specialChars;

  if (chars.length === 0) {
    chars = uppercase + lowercase + numbers + specialChars;
  }

  let password = '';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);

  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }

  // Ensure at least one character from each included type
  if (includeUppercase && !/[A-Z]/.test(password)) {
    const pos = Math.floor(Math.random() * length);
    password = password.substring(0, pos) + uppercase[Math.floor(Math.random() * uppercase.length)] + password.substring(pos + 1);
  }

  if (includeLowercase && !/[a-z]/.test(password)) {
    const pos = Math.floor(Math.random() * length);
    password = password.substring(0, pos) + lowercase[Math.floor(Math.random() * lowercase.length)] + password.substring(pos + 1);
  }

  if (includeNumbers && !/\d/.test(password)) {
    const pos = Math.floor(Math.random() * length);
    password = password.substring(0, pos) + numbers[Math.floor(Math.random() * numbers.length)] + password.substring(pos + 1);
  }

  if (includeSpecialChars && !/[!@#$%^&*()_+\-=]/.test(password)) {
    const pos = Math.floor(Math.random() * length);
    password = password.substring(0, pos) + specialChars[Math.floor(Math.random() * specialChars.length)] + password.substring(pos + 1);
  }

  return password;
}

/**
 * Estimate time to crack password
 */
export function estimateCrackTime(score: number): string {
  const times = {
    0: 'Instantly',
    1: 'Less than a minute',
    2: 'A few hours',
    3: 'A few months',
    4: 'Centuries',
  };
  return times[score as keyof typeof times] || 'Unknown';
}