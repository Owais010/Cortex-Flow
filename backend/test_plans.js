require('dotenv').config();
const crypto = require('crypto');
const supabase = require('./db/supabase');

async function test() {
  const { error } = await supabase.from('execution_plans').insert({ id: crypto.randomUUID(), session_id: crypto.randomUUID(), plan_json: {}, created_at: new Date().toISOString() });
  console.log(error);
}

test();
