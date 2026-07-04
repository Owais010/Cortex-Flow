const { createClient } = require("@supabase/supabase-js");
const config = require("../config");

const supabase = createClient(config.supabaseUrl, config.supabaseKey);

supabase.savePlanVersion = async function(planId, sessionId, planJson, version) {
  const crypto = require('crypto');
  const rowId = crypto.randomUUID();
  const { data, error } = await supabase.from('plans').insert({
    id: rowId,
    plan_id: planId,
    plan_version: version,
    session_id: sessionId,
    plan_json: planJson,
    created_at: new Date().toISOString()
  });
  return { data, error, rowId };
};

supabase.getLatestPlan = async function(planId) {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('plan_id', planId)
    .order('plan_version', { ascending: false })
    .limit(1)
    .single();
  return { data, error };
};

console.log("✅ Supabase client initialized");

module.exports = supabase;
