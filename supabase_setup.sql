-- Agri-Trust Supabase Initial Database Schema Setup
-- Run this entire script in the Supabase SQL Editor

-- 1. Create Farmers Table
CREATE TABLE public.farmers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rfid_tag TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    group_class TEXT,
    location TEXT,
    joined_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Devices Table
CREATE TABLE public.devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_name TEXT UNIQUE NOT NULL,
    device_type TEXT NOT NULL, -- e.g., 'edge_master', 'sensor_node'
    status TEXT DEFAULT 'offline',
    last_ping TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Create Scans (Batches) Table
CREATE TABLE public.scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id TEXT UNIQUE NOT NULL,
    farmer_id UUID REFERENCES public.farmers(id) ON DELETE SET NULL,
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    overall_grade TEXT NOT NULL,
    confidence_score NUMERIC(4,3),
    weight_kg NUMERIC(6,3),
    gas_ppm NUMERIC(6,2),
    ai_detections JSONB, -- Stores the YOLOv8 output array
    image_url TEXT, -- URL to the image in the storage bucket
    tx_hash TEXT, -- Polygon transaction hash
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable Row Level Security (Required for security)
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- 5. Read Access (Public): Anyone can view the dashboard data
CREATE POLICY "Enable read access for all users" ON public.farmers FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.devices FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.scans FOR SELECT USING (true);

-- 6. Write Access (Protected): Only authenticated admins can modify data
-- This requires using Supabase Built-in Auth
CREATE POLICY "Enable insert for authenticated users" ON public.farmers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON public.farmers FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON public.farmers FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON public.devices FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON public.devices FOR UPDATE USING (auth.role() = 'authenticated');

-- Note: In a real system, the edge devices (Jetson/ESP32) would have a secure service role key 
-- or a specific JWT to insert into the `scans` table. For this demo, we allow authenticated users.
CREATE POLICY "Enable insert for authenticated users" ON public.scans FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ⚠️  CRITICAL PATCH — Run this if tx_hash is never persisting after blockchain anchoring.
-- The scans UPDATE policy was missing, causing Supabase RLS to silently block tx_hash writes.
CREATE POLICY "Enable update for authenticated users" ON public.scans FOR UPDATE USING (auth.role() = 'authenticated');



-- 7. Insert Mock Data (Optional, just to test the frontend)
INSERT INTO public.farmers (id, rfid_tag, name, location, group_class)
VALUES 
  ('11111111-1111-1111-1111-111111111111', '0x4A:2F:8C:D1', 'Ahmad Rizal', 'Bandung, West Java', 'Group A'),
  ('22222222-2222-2222-2222-222222222222', '0x7B:3E:9A:F2', 'Siti Nurhaliza', 'Lembang, West Java', 'Group B');

INSERT INTO public.devices (id, device_name, device_type, status)
VALUES 
  ('33333333-3333-3333-3333-333333333333', 'JETSON_NANO_01', 'edge_master', 'online'),
  ('44444444-4444-4444-4444-444444444444', 'ESP32_NODE_01', 'sensor_node', 'online');

-- Insert a test scan referencing the mock farmer and device
INSERT INTO public.scans (batch_id, farmer_id, device_id, overall_grade, confidence_score, weight_kg, gas_ppm, ai_detections, image_url)
VALUES (
  'BATCH_2024_0846', 
  '11111111-1111-1111-1111-111111111111', 
  '33333333-3333-3333-3333-333333333333', 
  'Grade A', 
  0.950, 
  1.180, 
  98.00, 
  '[{"count": 3, "aiClass": "ripe", "confidence": 0.95}]'::jsonb,
  'https://images.unsplash.com/photo-1595858603623-86873531b7f0?q=80&w=400&auto=format&fit=crop'
);

-- ==========================================
-- STORAGE BUCKET INSTRUCTIONS
-- ==========================================
-- Supabase SQL Editor cannot easily create buckets with public access policies directly.
-- Please do the following manually in your Supabase Dashboard:
-- 1. Go to "Storage" in the left sidebar.
-- 2. Click "New Bucket" and name it exactly: scan-images
-- 3. Check the box "Public bucket" and click Save.
