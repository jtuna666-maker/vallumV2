# VELLUM

A web application for creating, managing, and printing custom memoirs, built with Next.js 16 and TypeScript.

Live site: [vallum-v2.vercel.app](https://vallum-v2.vercel.app)

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database & ORM:** Drizzle ORM
- **Fulfillment:** Lulu Print API
- **Analytics & Hosting:** Vercel Web Analytics & Vercel Hosting

---

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or pnpm

### Installation

1. Clone the repository:
```bash
   git clone https://github.com/jtuna666-maker/vallumV2.git
   cd vallumV2
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   Copy `.env.example` to `.env.local` and add the required keys:
   ```bash
   cp .env.example .env.local
   ```
   4. Run the development server:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 to view the app.

---

## Environment Variables

Make sure to configure the following in `.env.local` (and in your Vercel project dashboard):

- Database connection strings / Drizzle credentials
- Lulu API credentials (client key, secret, and target environment)
- Public app URLs

---

## Deployment

The app deploys automatically to Vercel when changes are merged into the `main` branch.
      
   
