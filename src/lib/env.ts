/**
 * Environment Variable Validation & Configuration
 * 
 * This module provides safe access to environment variables with proper validation
 * and error handling. It prevents runtime crashes from missing configuration.
 */

/**
 * Required environment variables with descriptions
 */
const ENV_VAR_DEFS = {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: {
    description: 'Supabase project URL',
    required: true,
    public: true,
  },
  NEXT_PUBLIC_SUPABASE_ANON_KEY: {
    description: 'Supabase anonymous key for client-side access',
    required: true,
    public: true,
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    description: 'Supabase service role key for server-side admin access',
    required: true,
    public: false,
  },

  // Stripe
  STRIPE_SECRET_KEY: {
    description: 'Stripe secret API key',
    required: true,
    public: false,
  },
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: {
    description: 'Stripe publishable key for client-side',
    required: true,
    public: true,
  },
  STRIPE_MONTHLY_PRICE_ID: {
    description: 'Stripe price ID for monthly subscription',
    required: true,
    public: false,
  },
  STRIPE_YEARLY_PRICE_ID: {
    description: 'Stripe price ID for yearly subscription',
    required: true,
    public: false,
  },
  STRIPE_WEBHOOK_SECRET: {
    description: 'Stripe webhook signing secret',
    required: true,
    public: false,
  },

  // Application
  NEXT_PUBLIC_APP_URL: {
    description: 'Base URL of the application',
    required: true,
    public: true,
  },

  // Email (Resend)
  RESEND_API_KEY: {
    description: 'Resend API key for sending emails',
    required: false, // Optional - app works without email
    public: false,
  },
  EMAIL_FROM: {
    description: 'Sender email address for emails',
    required: false, // Optional - app works without email
    public: false,
  },

  // SMS (Twilio)
  TWILIO_ACCOUNT_SID: {
    description: 'Twilio account SID for sending SMS',
    required: false, // Optional - app works without SMS
    public: false,
  },
  TWILIO_AUTH_TOKEN: {
    description: 'Twilio auth token for sending SMS',
    required: false, // Optional - app works without SMS
    public: false,
  },
  TWILIO_PHONE_NUMBER: {
    description: 'Twilio phone number for sending SMS',
    required: false, // Optional - app works without SMS
    public: false,
  },
} as const;

export type EnvVarName = keyof typeof ENV_VAR_DEFS;

/**
 * Get an environment variable safely
 * @throws Error if required variable is missing
 */
export function getEnvVar(name: EnvVarName): string {
  const value = process.env[name];
  const def = ENV_VAR_DEFS[name];

  if (!value && def?.required) {
    const note = def.public
      ? `Note: This is a public variable (NEXT_PUBLIC_) and should be set in both .env and your hosting platform.`
      : `Note: This is a server-side variable and should be set in your hosting platform's environment settings.`;
    throw new Error(
      `Missing required environment variable: ${name}\n` +
      `Description: ${def.description}\n` +
      note
    );
  }

  if (!value) {
    return ''; // Return empty string for optional variables
  }

  return value;
}

/**
 * Get an environment variable with a default value
 */
export function getEnvVarWithDefault(name: EnvVarName, defaultValue: string): string {
  const value = process.env[name];
  return value || defaultValue;
}

/**
 * Validate all required environment variables at startup
 * Call this in your app's entry point or a server initialization script
 */
export function validateEnvVars(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [name, def] of Object.entries(ENV_VAR_DEFS)) {
    if (def.required && !process.env[name]) {
      errors.push(
        `Missing ${name}: ${def.description} ` +
        `(${def.public ? 'public' : 'server-side only'})`
      );
    }
  }

  if (errors.length > 0) {
    console.error('[Env] Environment Variable Validation Failed:', errors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if running in production environment
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development environment
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in test environment
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Get the application URL (handles both relative and absolute URLs)
 * Returns a fallback if the env var is missing, rather than throwing
 */
export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || '';
  if (!url) {
    console.warn('[Env] NEXT_PUBLIC_APP_URL is not set, using fallback');
    // In production, try to construct from vercel url
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    // Last resort fallback for development
    return 'http://localhost:3000';
  }
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * Export typed environment getters for common use cases
 */
export const env = {
  // Supabase
  supabaseUrl: () => getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: () => getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: () => getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),

  // Stripe
  stripeSecretKey: () => getEnvVar('STRIPE_SECRET_KEY'),
  stripePublishableKey: () => getEnvVar('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
  stripeMonthlyPriceId: () => getEnvVar('STRIPE_MONTHLY_PRICE_ID'),
  stripeYearlyPriceId: () => getEnvVar('STRIPE_YEARLY_PRICE_ID'),
  stripeWebhookSecret: () => getEnvVar('STRIPE_WEBHOOK_SECRET'),

  // Application
  appUrl: () => getAppUrl(),

  // SMS (Twilio)
  twilioAccountSid: () => getEnvVarWithDefault('TWILIO_ACCOUNT_SID', ''),
  twilioAuthToken: () => getEnvVarWithDefault('TWILIO_AUTH_TOKEN', ''),
  twilioPhoneNumber: () => getEnvVarWithDefault('TWILIO_PHONE_NUMBER', ''),
};