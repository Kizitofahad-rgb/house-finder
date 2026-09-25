/*
# HouseFinder Uganda — Core Database Foundation

## Overview
Creates the four core tables for the HouseFinder property discovery platform:
profiles, listings, property_leads, and listing_reports.

## New Tables

### 1. profiles
Stores extended user data linked to Supabase auth.users.
- id (uuid, PK, references auth.users)
- email (text)
- full_name (text)
- role (text: seeker, landlord, agent, admin)
- phone (text)
- created_at (timestamptz)

### 2. listings
Property listings with full source-tracking fields for the future
property discovery engine.
- id (uuid, PK)
- title, description, category, location, area, city
- price (integer), price_period (text)
- bedrooms, bathrooms (integer)
- images (text array)
- landlord_name, landlord_phone, landlord_whatsapp (text)
- source_type, source_url, source_name, source_listing_id (text) — for acquisition tracking
- status (text: draft, pending, published, expired, rejected)
- active, verified, featured, spotlight, imported (booleans)
- verification_notes (text)
- views (integer)
- created_by (uuid, references auth.users)
- created_at, updated_at, published_at, expires_at (timestamptz)

### 3. property_leads
Inquiries from seekers about specific listings.
- id (uuid, PK)
- listing_id (uuid, references listings)
- seeker_id (uuid, references auth.users)
- name, phone, message (text)
- created_at (timestamptz)

### 4. listing_reports
User-submitted reports about listings.
- id (uuid, PK)
- listing_id (uuid, references listings)
- reporter_id (uuid, references auth.users)
- reason, details (text)
- created_at (timestamptz)

## Security (RLS)
- profiles: users can read/update their own profile; anyone can read profiles (for landlord contact info on listings)
- listings: published+active listings are publicly readable (anon+authenticated); authenticated users can insert/update/delete their own listings
- property_leads: authenticated users can create leads; listing owners can read leads for their listings
- listing_reports: authenticated users can create reports; listing owners can read reports for their listings
*/

-- ================= PROFILES =================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  role text NOT NULL DEFAULT 'seeker',
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ================= LISTINGS =================
CREATE TABLE IF NOT EXISTS public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  description text,
  category text,
  location text,
  area text,
  city text,
  price integer,
  price_period text DEFAULT 'monthly',
  bedrooms integer DEFAULT 0,
  bathrooms integer DEFAULT 0,
  images text[] DEFAULT '{}',
  landlord_name text,
  landlord_phone text,
  landlord_whatsapp text,
  source_type text DEFAULT 'manual',
  source_url text,
  source_name text,
  source_listing_id text,
  status text NOT NULL DEFAULT 'draft',
  active boolean NOT NULL DEFAULT true,
  verified boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  spotlight boolean NOT NULL DEFAULT false,
  imported boolean NOT NULL DEFAULT false,
  verification_notes text,
  views integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  expires_at timestamptz
);

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Public can read published active listings
DROP POLICY IF EXISTS "listings_select_published" ON public.listings;
CREATE POLICY "listings_select_published"
  ON public.listings FOR SELECT
  TO anon, authenticated USING (active = true AND status = 'published');

-- Owners can read all their own listings (including drafts)
DROP POLICY IF EXISTS "listings_select_own" ON public.listings;
CREATE POLICY "listings_select_own"
  ON public.listings FOR SELECT
  TO authenticated USING (auth.uid() = created_by);

-- Authenticated users can insert listings they own
DROP POLICY IF EXISTS "listings_insert_own" ON public.listings;
CREATE POLICY "listings_insert_own"
  ON public.listings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

-- Owners can update their own listings
DROP POLICY IF EXISTS "listings_update_own" ON public.listings;
CREATE POLICY "listings_update_own"
  ON public.listings FOR UPDATE
  TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

-- Owners can delete their own listings
DROP POLICY IF EXISTS "listings_delete_own" ON public.listings;
CREATE POLICY "listings_delete_own"
  ON public.listings FOR DELETE
  TO authenticated USING (auth.uid() = created_by);

-- ================= PROPERTY_LEADS =================
CREATE TABLE IF NOT EXISTS public.property_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  seeker_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text,
  phone text,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.property_leads ENABLE ROW LEVEL SECURITY;

-- Authenticated users can create leads
DROP POLICY IF EXISTS "leads_insert" ON public.property_leads;
CREATE POLICY "leads_insert"
  ON public.property_leads FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = seeker_id);

-- Listing owners can read leads for their listings
DROP POLICY IF EXISTS "leads_select_owner" ON public.property_leads;
CREATE POLICY "leads_select_owner"
  ON public.property_leads FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = property_leads.listing_id
      AND listings.created_by = auth.uid()
    )
  );

-- ================= LISTING_REPORTS =================
CREATE TABLE IF NOT EXISTS public.listing_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.listing_reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users can create reports
DROP POLICY IF EXISTS "reports_insert" ON public.listing_reports;
CREATE POLICY "reports_insert"
  ON public.listing_reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- Listing owners can read reports for their listings
DROP POLICY IF EXISTS "reports_select_owner" ON public.listing_reports;
CREATE POLICY "reports_select_owner"
  ON public.listing_reports FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = listing_reports.listing_id
      AND listings.created_by = auth.uid()
    )
  );

-- ================= INDEXES =================
CREATE INDEX IF NOT EXISTS idx_listings_status_active ON public.listings (status, active);
CREATE INDEX IF NOT EXISTS idx_listings_created_by ON public.listings (created_by);
CREATE INDEX IF NOT EXISTS idx_listings_category ON public.listings (category);
CREATE INDEX IF NOT EXISTS idx_listings_featured ON public.listings (featured);
CREATE INDEX IF NOT EXISTS idx_listings_spotlight ON public.listings (spotlight);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON public.listings (created_at DESC);

-- ================= AUTO-UPDATE TRIGGER =================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS listings_updated_at ON public.listings;
CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ================= AUTO-CREATE PROFILE TRIGGER =================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.raw_user_meta_data->>'role', 'seeker'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();