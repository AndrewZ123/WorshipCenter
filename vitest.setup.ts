/**
 * Test environment setup.
 *
 * These are obviously fake values for the same env var names the app uses in
 * production. Tests never load .env files and never reach a real service.
 */
// Vitest already sets NODE_ENV=test.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.RESEND_API_KEY = 'test-resend-api-key';
process.env.EMAIL_FROM = 'WorshipCenter Test <test@example.com>';
