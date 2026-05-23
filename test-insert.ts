import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  console.log("Fetching a dispute...");
  const { data: dispute, error: fetchErr } = await supabase.from('disputes').select('id').limit(1).single();
  
  if (fetchErr || !dispute) {
    console.error("No dispute found to attach to.", fetchErr);
    return;
  }

  console.log("Attempting insert with author_type = 'customer'...");
  const { data, error } = await supabase.from('dispute_responses').insert([{
    dispute_id: dispute.id,
    author_type: 'customer',
    author_name: 'Test Customer',
    message: 'Test Message'
  }]);

  if (error) {
    console.error("INSERT FAILED:");
    console.error(error);
  } else {
    console.log("INSERT SUCCESS!");
  }
}

testInsert();
