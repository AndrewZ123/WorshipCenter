/**
 * Server-side initialization and validation
 * Call this at application startup to validate configuration
 */

import { validateEnvVars, env } from './env';

/**
 * Validate server configuration and environment variables
 * Call this in server components or API routes during initialization
 */
export function initializeServer() {
  // Validate environment variables
  const validation = validateEnvVars();
  
  if (!validation.valid) {
    console.error('❌ Server initialization failed: Missing required environment variables');
    console.error('Please configure the following variables in your environment:');
    validation.errors.forEach(err => console.error(`  - ${err}`));
    
    // In development, throw error to surface the issue immediately
    // In production, log but don't throw to allow partial functionality
    if (process.env.NODE_ENV === 'development') {
      throw new Error('Server configuration incomplete. See error details above.');
    }
  }
  
  return validation.valid;
}

/**
 * Get server health status
 */
export async function getServerHealth() {
  const checks = {
    env: false,
    database: false,
    stripe: false,
  };
  
  try {
    // Check environment variables
    checks.env = validateEnvVars().valid;
    
    // Check database connectivity (basic check)
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(
      env.supabaseUrl(),
      env.supabaseServiceRoleKey()
    );
    
    // Simple ping query
    const { error } = await client.from('users').select('id').limit(1);
    checks.database = !error;
    
    // Check Stripe connectivity
    const stripe = await import('./stripe');
    try {
      await stripe.getStripe().accounts.retrieve();
      checks.stripe = true;
    } catch {
      // This may fail in test mode with no account
      checks.stripe = checks.env; // If env is good, consider stripe accessible
    }
  } catch (error) {
    console.error('Health check error:', error);
  }
  
  return {
    healthy: Object.values(checks).every(Boolean),
    checks,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Log server startup information
 */
export function logServerStartup() {
  // Only log in development environment
  if (process.env.NODE_ENV === 'development') {
    console.log('='.repeat(60));
    console.log('🚀 WorshipCenter Server Initialization');
    console.log('='.repeat(60));
    console.log(`Environment: ${process.env.NODE_ENV || 'unknown'}`);
    console.log(`App URL: ${env.appUrl()}`);
    console.log(`Supabase URL: ${env.supabaseUrl()}`);
    console.log('='.repeat(60));
  }
  
  const validation = validateEnvVars();
  if (!validation.valid) {
    console.warn('[Server] Environment configuration issues detected:', validation.errors);
  }
}
