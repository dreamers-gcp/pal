# PAL — Professor Admin Learner Platform

A calendar management web app with 3 user roles:

- **Professor**: Creates calendar block requests (student group + classroom + time)
- **Admin**: Reviews requests — approve, reject, or ask for clarification
- **Student**: Sees upcoming approved events for their assigned group

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Row Level Security)

---

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (free tier is fine)
2. Click **"New Project"** — pick a name and password, choose a region close to you
3. Wait ~2 minutes for it to provision

### 2. Set Up the Database

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Copy the entire contents of `supabase/schema.sql` from this project and paste it
4. Click **"Run"** — this creates all tables, security policies, triggers, and seed data

### 3. Configure Auth

1. In the Supabase dashboard, go to **Authentication** > **Settings** > **Email**
2. For local development, **disable** "Confirm Email" (toggle it off) — this lets you sign up and immediately log in without email verification
3. (Optional) Under **URL Configuration**, set the Site URL to `http://localhost:3000`

### 4. Get Your API Keys

1. Go to **Project Settings** (gear icon) > **API**
2. Copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon/public** key (the long `eyJ...` string)

### 5. Configure Environment Variables

Edit the `.env.local` file in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-key
```

### 6. Run the Development Server

```bash
# Install dependencies (if not already done)
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## How to Test the Full Flow

### Step 1: Create test accounts

Sign up 3 different accounts (use different emails):

| Email                | Role      |
| -------------------- | --------- |
| admin@test.com       | Admin     |
| professor@test.com   | Professor |
| student@test.com     | Student   |

### Step 2: Assign student to a group

In Supabase dashboard, go to **Table Editor** > **profiles** table, find the student row, and set the `student_group` column to one of the group names (e.g., `CS-2024-A`).

### Step 3: Professor creates a request

1. Log in as `professor@test.com`
2. Click **"New Request"**
3. Fill in event title, pick student group (`CS-2024-A`), a classroom, date, and times
4. Submit

### Step 4: Admin reviews the request

1. Log in as `admin@test.com`
2. You'll see the pending request
3. Click it → Approve / Reject / Ask for Clarification

### Step 5: Student sees the event

1. Log in as `student@test.com`
2. The approved event appears under **Upcoming Events**

---

## Project Structure

```
src/
├── app/
│   ├── auth/callback/     # Supabase auth callback handler
│   ├── dashboard/         # Protected dashboard (role-based)
│   ├── login/             # Login page
│   ├── signup/            # Signup page with role selection
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── components/
│   ├── dashboards/
│   │   ├── admin-dashboard.tsx
│   │   ├── professor-dashboard.tsx
│   │   └── student-dashboard.tsx
│   ├── navbar.tsx
│   └── ui/                # shadcn/ui components
├── hooks/
│   └── use-auth.ts        # Auth hook with profile loading
├── lib/
│   ├── supabase/
│   │   ├── client.ts      # Browser Supabase client
│   │   ├── middleware.ts   # Session management
│   │   └── server.ts      # Server Supabase client
│   ├── types.ts           # TypeScript types
│   └── utils.ts
├── middleware.ts           # Next.js middleware (auth guard)
supabase/
└── schema.sql             # Database schema (run in SQL Editor)
```
