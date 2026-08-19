-- SubKill logical schema. v1 can map 1:1 onto Firestore collections.
-- Tokens never leave Secret Manager / encrypted columns. Client never sees refresh_token.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE plan_t AS ENUM ('free', 'pro');
CREATE TYPE provider_t AS ENUM ('gmail', 'outlook');
CREATE TYPE billing_cycle_t AS ENUM ('weekly', 'monthly', 'yearly');
CREATE TYPE sub_status_t AS ENUM ('active', 'canceled', 'trial');
CREATE TYPE waste_reason_t AS ENUM ('forgotten', 'duplicate', 'expensive', 'trial_trap', 'healthy');
CREATE TYPE cancel_method_t AS ENUM ('direct_link', 'ai_email', 'instruction');
CREATE TYPE cancel_status_t AS ENUM ('initiated', 'confirmed', 'failed');
CREATE TYPE billing_source_t AS ENUM ('web', 'stripe', 'paypal', 'apple', 'google_play', 'paddle', 'recurly', 'unknown');
CREATE TYPE scan_status_t AS ENUM ('queued', 'running', 'done', 'failed');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  total_saved_cents INTEGER NOT NULL DEFAULT 0,
  plan plan_t NOT NULL DEFAULT 'free',
  cancellations_used INTEGER NOT NULL DEFAULT 0,
  free_cancel_limit INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider provider_t NOT NULL,
  google_sub TEXT,
  last_scan_at TIMESTAMPTZ,
  UNIQUE (user_id, provider)
);

-- OAuth tokens live here, not on the client, not in Firestore user docs.
CREATE TABLE oauth_tokens (
  connected_account_id UUID PRIMARY KEY REFERENCES connected_accounts(id) ON DELETE CASCADE,
  refresh_token_encrypted BYTEA NOT NULL,
  access_token_encrypted BYTEA,
  access_token_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['gmail.readonly']
);

CREATE TABLE scan_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connected_account_id UUID NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
  status scan_status_t NOT NULL DEFAULT 'queued',
  pass SMALLINT NOT NULL DEFAULT 1,
  emails_scanned INTEGER NOT NULL DEFAULT 0,
  hits INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  logo_url TEXT,
  price NUMERIC(10,2),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  billing_cycle billing_cycle_t NOT NULL DEFAULT 'monthly',
  next_billing_date DATE,
  source_email_id TEXT,
  billing_source billing_source_t NOT NULL DEFAULT 'unknown',
  category TEXT NOT NULL DEFAULT 'other',
  status sub_status_t NOT NULL DEFAULT 'active',
  last_activity_at TIMESTAMPTZ,
  waste_score SMALLINT NOT NULL DEFAULT 0 CHECK (waste_score BETWEEN 0 AND 100),
  waste_reason waste_reason_t NOT NULL DEFAULT 'healthy',
  cancel_url TEXT,
  UNIQUE (user_id, slug, price)
);

CREATE INDEX subscriptions_user_score ON subscriptions (user_id, waste_score DESC);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  billed_on DATE NOT NULL,
  is_trial BOOLEAN NOT NULL DEFAULT FALSE,
  source_email_id TEXT
);

CREATE TABLE cancellation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  method cancel_method_t NOT NULL,
  status cancel_status_t NOT NULL DEFAULT 'initiated',
  email_template TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE service_groups (
  id TEXT PRIMARY KEY,          -- e.g. 'ai', 'streaming'
  label TEXT NOT NULL
);

CREATE TABLE service_aliases (
  slug TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES service_groups(id),
  display_name TEXT NOT NULL
);

CREATE TABLE cancel_urls (
  slug TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  cancel_url TEXT,
  billing_source billing_source_t NOT NULL DEFAULT 'web',
  method cancel_method_t NOT NULL
);

CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,           -- trial_ending | daily_scan | re_subscribe
  fire_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ
);

CREATE TABLE category_medians (
  category TEXT PRIMARY KEY,
  median_monthly NUMERIC(10,2) NOT NULL
);
