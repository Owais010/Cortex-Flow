require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function test() {
  const { error: err1 } = await supabase
    .from('model_registry')
    .update({ model_id: 'gemini-2.5-flash' })
    .in('model_id', ['gemini-1.5-flash', 'gemini-1.5-flash-latest']);

  const { error: err2 } = await supabase
    .from('model_registry')
    .update({ model_id: 'gemini-2.5-pro' })
    .in('model_id', ['gemini-1.5-pro', 'gemini-1.5-pro-latest']);

  if (err1) console.error(err1);
  if (err2) console.error(err2);
  console.log('Updated DB to 2026 Gemini models');
}
test();
