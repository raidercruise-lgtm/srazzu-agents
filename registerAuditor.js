// registerAuditor.js
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from your .env file
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
// Targeting your backend admin secret key
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error("❌ Error: SUPABASE_URL or SUPABASE_SECRET_KEY is missing from your .env file!");
  process.exit(1);
}

// Initializing with the SECRET key to bypass Row-Level Security (RLS)
const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function registerAgent() {
  console.log("⏳ Registering Audit Unit-03 in Supabase using admin Secret Key...");

  const { data, error } = await supabase
    .from('ai_employees')
    .insert([
      {
        id: "audit-03",
        name: "Audit Unit-03",
        role: "Auditor",
        system_instructions: "You are a senior quality assurance auditor. Review draft communications, look for inconsistencies, tone misalignment, or missing details, and provide a polished, finalized response with a clean layout.",
        capabilities: ["quality-assurance", "copy-editing", "policy-compliance"],
        status: "active"
      }
    ])
    .select();

  if (error) {
    console.error("❌ Error inserting agent:", error);
  } else {
    console.log("✅ Successfully registered Audit Unit-03!", data);
  }
}

registerAgent();