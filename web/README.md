# WorshipCenter Marketing Website

A modern, beautiful marketing website for WorshipCenter - a SaaS worship planning tool built for church worship leaders.

## 🎯 Overview

This is the marketing website for WorshipCenter, located at `worshipcenter.app`. The main application lives at `app.worshipcenter.app`.

## 🛠 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Font**: Inter (via next/font)
- **Deployment**: Static/SSG (no backend)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd worshipcenter-web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.local.example .env.local
   ```

4. Update `.env.local` with your values:
   ```
   NEXT_PUBLIC_APP_URL=https://app.worshipcenter.app
   NEXT_PUBLIC_CONTACT_EMAIL=hello@worshipcenter.app
   ```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

### Build

Build for production:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## 📁 Project Structure

```
src/
├── app/
│   ├── layout.tsx         # Root layout with Inter font
│   ├── page.tsx           # Homepage
│   ├── pricing/
│   │   └── page.tsx       # Pricing page
│   ├── about/
│   │   └── page.tsx       # About page
│   └── globals.css        # Global styles
├── components/
│   ├── nav/
│   │   └── Navbar.tsx     # Sticky navigation
│   ├── footer/
│   │   └── Footer.tsx     # Site footer
│   ├── home/              # Homepage sections
│   │   ├── Hero.tsx
│   │   ├── PainPoints.tsx
│   │   ├── Features.tsx
│   │   ├── HowItWorks.tsx
│   │   ├── RotationSection.tsx
│   │   ├── Pricing.tsx
│   │   └── ClosingCTA.tsx
│   ├── pricing/           # Pricing page components
│   │   ├── PricingCard.tsx
│   │   └── FAQ.tsx
│   ├── about/             # About page components
│   │   ├── FounderStory.tsx
│   │   ├── Values.tsx
│   │   └── AboutCTA.tsx
│   └── ui/                # Shared UI components
│       ├── Badge.tsx
│       ├── Button.tsx
│       └── Card.tsx
└── lib/
    └── constants.ts       # App URLs, social links
```

## 🎨 Design System

### Colors

| Name | Tailwind Class | Hex |
|------|---------------|-----|
| Primary | `brand-600` | `#0D9488` |
| Primary Light | `brand-100` | `#CCFBF1` |
| Text | `slate-900` | `#0F172A` |
| Background | `white` / `slate-50` | `#FFFFFF` / `#F8FAFC` |

### Typography

- **Font**: Inter (variable weight)
- **Headlines**: Bold (700)
- **Body**: Regular (400)

### Animations

Using Framer Motion for:
- Hero headline fade-up on load
- Feature cards fade-in on scroll (staggered)
- Pain point cards fade-in on scroll
- Pricing card scale-up on hover
- Nav background blur on scroll

## 🚢 Deployment

### Vercel (Recommended)

1. Push your code to GitHub

2. Import the project in Vercel:
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Select your repository
   - Configure environment variables
   - Deploy

3. Configure custom domain:
   - Add `worshipcenter.app` in project settings
   - Update DNS records as instructed

### Environment Variables

Set these in your Vercel project settings:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | URL of the main app (e.g., `https://app.worshipcenter.app`) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Contact email address |

## 📱 Responsive Breakpoints

- **Mobile**: < 768px (single column)
- **Tablet**: 768px - 1024px (2-column grids)
- **Desktop**: > 1024px (full layouts)

## 🔍 SEO

Metadata is configured in:
- `src/app/layout.tsx` - Global metadata
- Individual page files - Page-specific metadata

## 📄 License

Copyright © 2026 WorshipCenter. All rights reserved.