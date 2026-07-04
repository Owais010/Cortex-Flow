const fetch = require('node-fetch'); // we can just use native fetch
async function test() {
  const supabaseUrl = "https://example.supabase.co"; // just some fake
  const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid";
  
  const response = await fetch(`${supabaseUrl}/rest/v1/sessions`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const data = await response.json();
  console.log(data);
}
test();
