-- ============================================================
-- Migration: Marketing Master Database Schema
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT DEFAULT 'مستخدم جديد',
  avatar_url TEXT DEFAULT '',
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'agency', 'enterprise')),
  gemini_api_key_token TEXT,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- 2. Projects
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  data JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- 3. Payments
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  plan TEXT,
  amount TEXT,
  status TEXT DEFAULT 'paid',
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- 4. Integration Settings
CREATE TABLE IF NOT EXISTS integration_settings (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT DEFAULT 'shopify',
  map_customer_name TEXT DEFAULT 'customer.first_name',
  map_customer_phone TEXT DEFAULT 'customer.phone',
  map_product_title TEXT DEFAULT 'line_items[0].title',
  map_wilaya TEXT DEFAULT 'shipping_address.province',
  map_total_price TEXT DEFAULT 'total_price',
  UNIQUE(user_id)
);

-- 5. Incoming Orders (from Webhooks)
CREATE TABLE IF NOT EXISTS incoming_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source TEXT DEFAULT 'shopify',
  customer_name TEXT,
  customer_phone TEXT,
  phone_status TEXT,
  wilaya TEXT,
  wilaya_code TEXT,
  product_name TEXT,
  total_price REAL DEFAULT 0,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);
CREATE INDEX IF NOT EXISTS idx_incoming_orders_user ON incoming_orders(user_id);

-- 6. Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  url TEXT,
  events TEXT[] DEFAULT '{}'
);

-- 7. Blacklist
CREATE TABLE IF NOT EXISTS blacklist (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  reason TEXT DEFAULT '',
  reported_by TEXT DEFAULT '',
  report_count INTEGER DEFAULT 1,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);
CREATE INDEX IF NOT EXISTS idx_blacklist_phone ON blacklist(phone);

-- 8. REVIT Orders (Fraud Detection)
CREATE TABLE IF NOT EXISTS revit_orders (
  id TEXT PRIMARY KEY,
  merchant_id TEXT DEFAULT 'usr_static',
  customer_name TEXT,
  customer_phone TEXT,
  wilaya TEXT,
  wilaya_code TEXT,
  commune TEXT,
  address TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','delivered','returned','cancelled')),
  final_score INTEGER DEFAULT 0,
  risk_level TEXT DEFAULT 'safe' CHECK (risk_level IN ('safe','suspicious','danger')),
  risk_factors JSONB DEFAULT '[]'::jsonb,
  total_price REAL DEFAULT 0,
  source TEXT DEFAULT 'manual',
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);
CREATE INDEX IF NOT EXISTS idx_revit_orders_phone ON revit_orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_revit_orders_status ON revit_orders(status);
CREATE INDEX IF NOT EXISTS idx_revit_orders_wilaya ON revit_orders(wilaya_code);

-- 9. Confirmation Codes (OTP)
CREATE TABLE IF NOT EXISTS confirmation_codes (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  phone TEXT,
  code TEXT,
  expires_at BIGINT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','verified','expired')),
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);
CREATE INDEX IF NOT EXISTS idx_confirmation_order ON confirmation_codes(order_id);
