require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const vault = require('./security/vault');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data: keys, error } = await supabase
    .from('api_key_vault')
    .select('*')
    .eq('provider', 'google_gemini')
    .eq('is_valid', true);

  for (const keyRow of keys || []) {
    let combined = keyRow.encrypted_key;
    if (!combined.includes(':')) combined = `${keyRow.iv}:${keyRow.auth_tag}:${keyRow.encrypted_key}`;
    let apiKey;
    try {
      apiKey = vault.decryptKey(combined);
    } catch (err) {
      continue;
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    if (data.models) {
      console.log(`Available Gemini text models for session ${keyRow.session_id}:`);
      console.log(data.models.map(m => m.name).filter(n => n.includes('gemini')).join('\n'));
    }
  }
}
check();
