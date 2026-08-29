# SH360 — Sekisui House 360 Leadership Survey Platform

A custom, AI-powered 360 leadership assessment platform built on the H.O.M.E.S. Leadership Blueprint, SEKISUI HOUSE-SHIP values, and the Integrity Code.

---

## Stack

- **Backend:** Node.js + Express
- **Database:** Supabase (PostgreSQL)
- **AI:** Anthropic Claude (report narrative generation)
- **Email:** Resend
- **Hosting:** Railway

---

## First-Time Setup

### 1. Database (Supabase)
1. Go to your Supabase project → SQL Editor
2. Paste and run the contents of `database_schema.sql`
3. Copy your Project URL and service_role key from Settings → API

### 2. Environment Variables
Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

Required:
- `SUPABASE_URL` — from Supabase Settings → API
- `SUPABASE_SERVICE_KEY` — the service_role key (not anon key)
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `RESEND_API_KEY` — from resend.com dashboard
- `FROM_EMAIL` — verified sender email in Resend
- `APP_URL` — your Railway app URL (e.g. https://sh360.up.railway.app)
- `SESSION_SECRET` — any long random string
- `ADMIN_PASSWORD` — your admin login password

### 3. Local Development

```bash
npm install
npm run dev
```

Visit http://localhost:3000

### 4. Deploy to Railway

1. Push this code to a GitHub repository
2. In Railway: New Project → Deploy from GitHub repo → select your repo
3. Add all environment variables in Railway dashboard (Variables tab)
4. Railway auto-deploys on every git push

---

## How It Works

### Survey Flow
1. Admin creates a **Cycle** (e.g. "2026 Mid-Year")
2. Admin adds **Leaders** to the cycle
3. Admin adds **Raters** (paste CSV: Name, Email, Group)
4. Admin sends invites — each rater gets a unique, anonymous link
5. Raters complete the 30-question survey + open text + Start/Stop/Continue
6. Admin generates the **AI Report** when enough responses are in

### Report Generation
When a report is triggered:
1. All scores are calculated by rater group
2. Blind spots, hidden strengths, high/low scores are flagged
3. Claude analyzes the score patterns and all open-text comments
4. Claude generates a HOMES-mapped narrative (JSON)
5. The full HTML report is built and saved to the database
6. Admin and leader can view the report at a unique URL

---

## Rater Groups
- `self` — leader rates themselves (auto-created)
- `supervisor` — the leader's direct manager
- `peer` — same-level colleagues
- `direct_report` — people who report to this leader
- `skip_level` — people who report to this leader's direct reports

---

## Adding Raters (Bulk Format)
In the admin panel, paste one rater per line:
```
Jane Smith, jane@sekisuihouse.com, supervisor
Tom Jones, tom@sekisuihouse.com, peer
Maria Garcia, maria@sekisuihouse.com, direct_report
```

---

## Survey Questions
All 30 questions are in `src/questions.js`. Edit there to update the instrument.
