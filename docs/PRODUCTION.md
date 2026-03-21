# WorshipCenter - Production Readiness Guide

This document summarizes the production configuration, security measures, and deployment requirements for WorshipCenter.

## Table of Contents
- [Required Environment Variables](#required-environment-variables)
- [External Services](#external-services)
- [Security Measures](#security-measures)
- [Multi-Tenancy](#multi-tenancy)
- [Deployment Checklist](#deployment-checklist)
- [Known Limitations](#known-limitations)

## Required Environment Variables

The following environment variables must be configured in your production environment:

### Database (Supabase)
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL (public, exposed to client)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (public, exposed to client)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-only, DO NOT expose to client)
- `NEXT_PUBLIC_SUPABASE_REDIRECT_URL` - URL for auth redirects (e.g., `https://app.worshipcenter.io`)

### Authentication
- `NEXTAUTH_SECRET` - Secret for NextAuth.js session encryption (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL` - Production URL for NextAuth.js (e.g., `https://app.worshipcenter.io`)

### Payment Processing (Stripe)
- `STRIPE_SECRET_KEY` - Stripe secret key (server-only)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key (public)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret for signature verification (server-only)
- `STRIPE_MONTHLY_PRICE_ID` - Stripe price ID for monthly subscription (server-only)
- `STRIPE_YEARLY_PRICE_ID` - Stripe price ID for yearly subscription (server-only)

### Email (Resend)
- `RESEND_API_KEY` - Resend API key for sending transactional emails (server-only)

### Application
- `NEXT_PUBLIC_APP_URL` - Production application URL (e.g., `https://app.worshipcenter.io`)

## External Services

### Database: Supabase
- **Purpose**: PostgreSQL database, authentication, real-time subscriptions
- **Features**: Row Level Security (RLS) policies for multi-tenant isolation
- **Configuration**: RLS policies enforce tenant isolation on all tables

### Payments: Stripe
- **Purpose**: Subscription billing and payment processing
- **Features**: 
  - Checkout sessions for new subscriptions
  - Webhook handlers for subscription events
  - Customer portal for plan management
- **Webhook Events Handled**:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

### Email: Resend
- **Purpose**: Transactional emails (password reset, team invites, etc.)
- **Features**: Graceful error handling if email sending fails

## Security Measures

### 1. Multi-Tenant Data Isolation
- **Row Level Security (RLS)**: All database tables have RLS policies enabled
- **Application-Level Checks**: Additional verification in `db` methods to prevent cross-tenant data access
- **Church ID Scoping**: All database queries filter by `church_id` from authenticated user

### 2. Authentication & Authorization
- **NextAuth.js**: Session management with secure, httpOnly cookies
- **Role-Based Access Control (RBAC)**: 
  - `admin`: Full access to all features
  - `team`: Limited access (cannot manage team members or billing)
- **Session Validation**: All protected routes verify user session before rendering

### 3. Input Validation & Sanitization
- **Sanitization**: All user inputs are sanitized before database operations:
  - HTML fields (notes, messages) sanitized using DOMPurify
  - String fields sanitized to prevent injection attacks
- **Validation**: API routes validate request bodies with Zod schemas
- **Type Safety**: TypeScript strict mode enabled for compile-time type checking

### 4. Error Handling
- **Structured Logging**: Errors logged with context (user ID, route, etc.)
- **Safe Error Messages**: Client receives generic error messages; details logged server-side
- **Try/Catch Wrappers**: All API routes wrap operations in try/catch blocks

### 5. Secrets Management
- **Server-Only Variables**: Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, etc.) never exposed to client
- **Environment Validation**: Startup validation ensures required variables are present
- **No Hardcoded Secrets**: All secrets read from `process.env`

### 6. CORS & API Security
- **Same-Origin Policy**: No public API endpoints; all routes authenticated
- **Webhook Signature Verification**: Stripe webhooks verify signatures to prevent forgery

## Multi-Tenancy

Every database operation enforces tenant isolation:

### Data Access Pattern
```typescript
// All operations require church_id
const service = await db.services.getById(id, churchId);
const songs = await db.songs.getByChurch(churchId);
```

### RLS Policies
- `SELECT`: Users can only read data from their church
- `INSERT`: Users can only insert data with their church_id
- `UPDATE`: Users can only update records from their church
- `DELETE`: Users can only delete records from their church

### Application-Level Defense
Even if RLS is misconfigured, application-level checks prevent data leaks:
```typescript
// Verify church_id matches before returning data
if (!item || item.church_id !== churchId) {
  return null;
}
```

## Deployment Checklist

### Before Deploying to Production

- [ ] Set all required environment variables in production
- [ ] Generate secure `NEXTAUTH_SECRET` (run `openssl rand -base64 32`)
- [ ] Configure Stripe webhook endpoint to production URL
- [ ] Verify Stripe webhook secret matches production webhook
- [ ] Set `NEXTAUTH_URL` to production domain
- [ ] Enable secure cookies (automatic in production with HTTPS)
- [ ] Run database migrations in production Supabase project
- [ ] Test authentication flow (signup, login, password reset)
- [ ] Test subscription flow (checkout, webhook processing)
- [ ] Verify RLS policies are enabled on all tables
- [ ] Test multi-tenant isolation (ensure users cannot access other churches' data)

### Post-Deployment

- [ ] Monitor application logs for errors
- [ ] Verify Stripe webhook events are being received and processed
- [ ] Test email delivery (password reset, team invites)
- [ ] Confirm real-time subscriptions (chat) are working
- [ ] Load test with multiple concurrent users

## Known Limitations

### 1. Rate Limiting
- No application-level rate limiting implemented
- Relies on Supabase and Stripe for API rate limits
- Consider implementing rate limiting for API routes in production

### 2. Email Failures
- If Resend email sending fails, the operation continues silently
- No retry logic for failed email sends
- Consider adding email queue with retry mechanism

### 3. File Uploads
- Song files are uploaded directly to Supabase Storage
- No file size limits enforced in application layer
- Consider adding file size validation on upload

### 4. Background Jobs
- Song usage tracking happens synchronously on service publish
- Could be slow for services with many songs
- Consider moving to background job queue

### 5. Pagination
- Some endpoints (chat messages) use simple limit/offset
- No cursor-based pagination for large datasets
- Consider implementing cursor pagination for better performance

## Troubleshooting

### Build Errors
- Ensure all environment variables are set
- Run `npm install` to ensure dependencies are up to date
- Check TypeScript errors with `npm run type-check`

### Runtime Errors
- Check browser console for client-side errors
- Check server logs for API errors
- Verify environment variables are correctly set
- Ensure database migrations have been applied

### Authentication Issues
- Verify `NEXTAUTH_SECRET` is set and matches between restarts
- Check `NEXTAUTH_URL` matches production domain
- Ensure Supabase auth is properly configured
- Check cookie settings (secure, httpOnly, sameSite)

### Payment Issues
- Verify Stripe webhook secret matches production webhook
- Check Stripe webhook endpoint is receiving events
- Verify `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` are correct
- Check subscription status in database matches Stripe

## Support

For issues or questions:
1. Check this documentation
2. Review application logs
3. Check Supabase and Stripe dashboards
4. Review error messages in browser console and server logs

---

**Last Updated**: 2025-03-21
**Version**: 1.0.0