require('dotenv').config();
const supabase = require('./db/supabase');

async function test() {
  const { data, error } = await supabase
    .from("api_key_vault")
    .select("provider")
    .limit(1);

  console.log("Data:", data);
  console.log("Error:", error);
}

test();
