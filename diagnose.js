import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

console.log("\n======================================================");
console.log("🔍 STARTING SRAZZU SYNC DATABASE DIAGNOSTICS");
console.log("======================================================\n");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ CRITICAL: Missing environment keys! Check your .env file.");
  process.exit(1);
}

console.log(`📡 URL Target: ${supabaseUrl}`);
const supabase = createClient(supabaseUrl, supabaseKey);

async function runDiagnostics() {
  try {
    console.log("\nStep 1: Verifying connection and table presence...");
    const { data: tableCheck, error: tableError } = await supabase
      .from('customer_sessions')
      .select('session_key')
      .limit(1);

    if (tableError) {
      if (tableError.code === 'PGRST116' || tableError.message.includes('not found') || tableError.message.includes('does not exist')) {
        console.log("❌ FAULT DETECTED: The 'customer_sessions' table does not exist in this database!");
        console.log("\n👉 FIX: Go to your Supabase SQL Editor and execute this query to create it:");
        console.log(`
        CREATE TABLE customer_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_key TEXT UNIQUE NOT NULL,
            history JSONB DEFAULT '[]'::jsonb,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        `);
      } else {
        console.error(`❌ Connection failed with PostgreSQL Error Code ${tableError.code}:`, tableError.message);
      }
      return;
    }

    console.log("✅ SUCCESS: 'customer_sessions' table detected on the network!");

    console.log("\nStep 2: Testing database write (Upsert) permissions...");
    const testSessionKey = `diagnostic_test_${Math.random().toString(36).substring(2, 7)}`;
    const { data: insertData, error: insertError } = await supabase
      .from('customer_sessions')
      .upsert({
        session_key: testSessionKey,
        history: [{ role: "system", content: "Diagnostics connection test run" }],
        updated_at: new Date()
      }, { onConflict: 'session_key' })
      .select();

    if (insertError) {
      console.error("❌ FAULT DETECTED: Write operations are failing!");
      console.error(`Error Code ${insertError.code}: ${insertError.message}`);
      
      if (insertError.message.includes('row-level security') || insertError.code === '42501') {
        console.log("\n👉 FIX: Row-Level Security (RLS) is enabled on 'customer_sessions' but no policies allow inserts.");
        console.log("Execute this in your Supabase SQL Editor to disable RLS restrictions for testing:");
        console.log(`
        ALTER TABLE customer_sessions DISABLE ROW LEVEL SECURITY;
        `);
      } else if (insertError.message.includes('unique constraint') || insertError.code === '42P10') {
        console.log("\n👉 FIX: Your 'session_key' column is missing the UNIQUE index constraint.");
        console.log("Run this in your Supabase SQL Editor:");
        console.log(`
        ALTER TABLE customer_sessions ADD CONSTRAINT unique_session_key UNIQUE (session_key);
        `);
      }
      return;
    }

    console.log("✅ SUCCESS: Diagnostic row committed and saved successfully!");
    console.log(`Created Row Key: ${testSessionKey}`);

    console.log("\nStep 3: Counting active records in Supabase...");
    const { count, error: countError } = await supabase
      .from('customer_sessions')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`📊 Active sessions in database: ${count} rows.`);
    }

    console.log("\n======================================================");
    console.log("🎉 DIAGNOSTICS COMPLETE: YOUR DATABASE IS 100% HEALTHY!");
    console.log("If you still see nothing in your browser, verify that you");
    console.log("are logged into the correct Supabase Organization account.");
    console.log("======================================================\n");

  } catch (err) {
    console.error("Unexpected diagnostic code crash:", err);
  }
}

runDiagnostics();