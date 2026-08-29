-- ============================================================
-- SH360 Database Schema
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- Survey cycles (e.g. "2026 Mid-Year")
CREATE TABLE cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | active | closed
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leaders being assessed
CREATE TABLE leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID REFERENCES cycles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT NOT NULL,
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Raters invited to give feedback on a leader
CREATE TABLE raters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id UUID REFERENCES leaders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  rater_group TEXT NOT NULL, -- self | supervisor | peer | direct_report | skip_level
  token TEXT UNIQUE NOT NULL, -- unique survey link token
  completed_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual question responses
CREATE TABLE responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id UUID REFERENCES raters(id) ON DELETE CASCADE,
  leader_id UUID REFERENCES leaders(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  section TEXT NOT NULL,
  score INTEGER CHECK (score >= 1 AND score <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Open text responses per section
CREATE TABLE open_text (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id UUID REFERENCES raters(id) ON DELETE CASCADE,
  leader_id UUID REFERENCES leaders(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Start/Stop/Continue final question
CREATE TABLE start_stop_continue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id UUID REFERENCES raters(id) ON DELETE CASCADE,
  leader_id UUID REFERENCES leaders(id) ON DELETE CASCADE,
  start_text TEXT,
  stop_text TEXT,
  continue_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id UUID REFERENCES leaders(id) ON DELETE CASCADE,
  report_html TEXT,
  report_data JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by TEXT -- 'ai' | 'manual'
);

-- ── Indexes for performance ──────────────────────────────────
CREATE INDEX idx_raters_token ON raters(token);
CREATE INDEX idx_raters_leader ON raters(leader_id);
CREATE INDEX idx_responses_rater ON responses(rater_id);
CREATE INDEX idx_responses_leader ON responses(leader_id);
CREATE INDEX idx_leaders_cycle ON leaders(cycle_id);

-- ── Row Level Security ───────────────────────────────────────
-- Enable RLS on all tables (service key bypasses this, public access blocked)
ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE raters ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE open_text ENABLE ROW LEVEL SECURITY;
ALTER TABLE start_stop_continue ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Only service role can access (our server uses service key, so this is fine)
-- No public policies = no public access
