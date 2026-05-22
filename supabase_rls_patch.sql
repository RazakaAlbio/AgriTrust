-- ============================================================
-- AgriTrust — Supabase RLS PATCH
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================
-- 
-- Problem: The scans table had no UPDATE policy.
-- Supabase RLS silently rejected tx_hash writes from the frontend,
-- so blockchain anchors appeared to succeed but tx_hash stayed NULL in DB.
--
-- Fix 1: Add the missing UPDATE policy
-- ============================================================

CREATE POLICY "Enable update for authenticated users"
  ON public.scans
  FOR UPDATE
  USING (auth.role() = 'authenticated');


-- ============================================================
-- Fix 2: Backfill the TX hash you already anchored on-chain.
-- Replace the values below with your real batch_id and tx_hash
-- from the "Recently Anchored" section in the Admin → Blockchain tab.
-- ============================================================

-- Example (update with your real values):
-- UPDATE public.scans
--   SET tx_hash = '0x771bec286af27ae469e5a6a5d737a34a82da4f2080185e94757c25988a8a5b61'
--   WHERE batch_id = 'YOUR_BATCH_ID_HERE';

-- ============================================================
-- After running Fix 1, go back to Admin → Blockchain tab and
-- re-anchor any scans that still show "Pending" — they will
-- now persist correctly.
-- ============================================================
