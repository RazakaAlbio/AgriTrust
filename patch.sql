-- Run this script in the Supabase SQL Editor to allow the "customer" role to send messages

ALTER TABLE public.dispute_responses DROP CONSTRAINT IF EXISTS dispute_responses_author_type_check;

ALTER TABLE public.dispute_responses ADD CONSTRAINT dispute_responses_author_type_check CHECK (author_type IN ('farmer', 'admin', 'customer'));
