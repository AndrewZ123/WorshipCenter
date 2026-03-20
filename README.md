# WorshipCenter

A comprehensive church service planning and team management application built with Next.js, Supabase, and Capacitor.

## Features

- **Service Planning**: Create and manage church services with songs, team assignments, and templates
- **Team Management**: Add and manage team members with role-based access control
- **Song Library**: Organize songs with YouTube video IDs for easy reference
- **Templates**: Reuse service plans with customizable templates
- **Real-time Chat**: Team communication with role-based chat permissions
- **Usage Tracking**: Monitor team and service usage metrics
- **Subscription Management**: Built-in Stripe integration with trial periods
- **Mobile Support**: Cross-platform mobile app via Capacitor

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript
- **UI Framework**: Chakra UI
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **Payments**: Stripe
- **Mobile**: Capacitor (iOS, Android)
- **PWA**: Next.js PWA for offline support

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- Stripe account (for subscriptions)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/AndrewZ123/WorshipCenter.git
cd WorshipCenter
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.vercel.example .env.local
```

Edit `.env.local` and add your Supabase and Stripe credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

4. Set up the database:
```bash
# Apply all migrations
npx tsx scripts/apply-migration.ts
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Database Schema

The database includes the following main tables:
- `churches`: Church information
- `users`: User profiles linked to auth
- `team_members`: Team member invitations
- `services`: Service plans
- `songs`: Song library
- `templates`: Service templates
- `chat_messages`: Team chat messages
- `subscriptions`: Billing and subscription info

See `supabase/schema.sql` for the complete schema and `supabase/migrations/` for migration history.

## Authentication

WorshipCenter uses Supabase Auth for authentication:
- **Sign Up**: Create a new church and user account
- **Join**: Accept team member invitations
- **Login**: Email/password authentication
- **Password Reset**: Email-based password recovery

## Role-Based Access Control

Three user roles with different permissions:
- **admin**: Full access to all features and billing
- **team**: Can manage services, songs, and chat
- **viewer**: Read-only access to services and songs

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Mobile Apps

Build mobile apps using Capacitor:

```bash
# iOS
npm run build
npx cap open ios

# Android
npm run build
npx cap open android
```

## Environment Variables

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Stripe publishable key
- `STRIPE_SECRET_KEY`: Stripe secret key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook secret

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (app)/             # Protected app pages
│   ├── api/               # API routes
│   ├── demo/              # Demo pages
│   └── login/             # Auth pages
├── components/             # React components
│   ├── layout/           # Layout components
│   └── ui/               # UI components
└── lib/                   # Utility libraries
    ├── auth.tsx           # Authentication logic
    ├── supabase.ts        # Supabase client
    └── stripe.ts          # Stripe integration
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details