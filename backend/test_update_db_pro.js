require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function test() {
  const { error } = await supabase
    .from('model_registry')
    .update({ model_id: 'gemini-1.5-pro-latest' })
    .eq('model_id', 'gemini-1.5-pro');

  if (error) console.error(error);
  else console.log('Updated successfully');
}
test();
