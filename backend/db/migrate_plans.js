require('dotenv').config({ path: '../.env' });
const supabase = require('./supabase');

async function migrate() {
  console.log("Migrating plans table...");
  const sql = `
    DROP TABLE IF EXISTS public.plans;
    CREATE TABLE public.plans (
      id UUID PRIMARY KEY,
      plan_id UUID NOT NULL,
      plan_version INTEGER NOT NULL,
      session_id UUID NOT NULL,
      plan_json JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(plan_id, plan_version)
    );
  `;
  
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.warn("Could not execute SQL via RPC. If this fails, the table must be created manually.", error.message);
  } else {
    console.log("Table plans recreated successfully.");
  }
}

migrate();
