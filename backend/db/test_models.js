require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const crypto = require('crypto');
const { getAvailableModels, getModelById, getProviderForModel } = require('./models');
const supabase = require('./supabase');

async function runTests() {
  console.log("🧪 Testing db/models.js Helpers\n");

  const sessionId = crypto.randomUUID();

  // Insert mock session
  await supabase.from("sessions").upsert({
    id: sessionId,
    token_hash: crypto.randomBytes(32).toString("hex"),
    expires_at: new Date(Date.now() + 86400000).toISOString()
  });

  // Test 1: getAvailableModels() with no connected keys -> returns []
  const modelsNoKeys = await getAvailableModels(sessionId);
  console.log("Test 1: getAvailableModels() with no keys");
  console.log(modelsNoKeys.length === 0 ? "✅ Passed" : "❌ Failed", `(Returned ${modelsNoKeys.length} models)`);

  // Insert mock key for anthropic
  await supabase.from("api_key_vault").insert([
    {
      session_id: sessionId,
      provider: "anthropic",
      encrypted_key: "mock",
      iv: "mock",
      auth_tag: "mock",
      key_hint: "mock",
      is_valid: true
    }
  ]);

  // Test 2: getAvailableModels() with anthropic key connected -> returns only anthropic models
  const modelsAnthropic = await getAvailableModels(sessionId);
  const allAnthropic = modelsAnthropic.every(m => m.provider === 'anthropic') && modelsAnthropic.length > 0;
  console.log("\nTest 2: getAvailableModels() with anthropic key connected");
  console.log(allAnthropic ? "✅ Passed" : "❌ Failed", `(Returned ${modelsAnthropic.length} models)`);

  // Insert other providers
  await supabase.from("api_key_vault").insert([
    { session_id: sessionId, provider: "openai", encrypted_key: "mock", iv: "mock", auth_tag: "mock", key_hint: "mock", is_valid: true },
    { session_id: sessionId, provider: "google_gemini", encrypted_key: "mock", iv: "mock", auth_tag: "mock", key_hint: "mock", is_valid: true }
  ]);

  // Test 3: getAvailableModels() with all 3 providers -> returns all active models
  const allModels = await getAvailableModels(sessionId);
  console.log("\nTest 3: getAvailableModels() with all 3 providers");
  console.log(allModels.length >= 6 ? "✅ Passed" : "❌ Failed", `(Returned ${allModels.length} models)`);

  // Test 4: getModelById() with valid id -> returns correct model object
  const gpt4o = await getModelById("gpt-4o", sessionId);
  console.log("\nTest 4: getModelById() with valid id");
  console.log(gpt4o && gpt4o.id === "gpt-4o" ? "✅ Passed" : "❌ Failed");

  // Test 5: getModelById() with id not in session -> returns null
  const notFound = await getModelById("nonexistent-model", sessionId);
  console.log("\nTest 5: getModelById() with id not in session");
  console.log(notFound === null ? "✅ Passed" : "❌ Failed");

  // Test 6: getProviderForModel('claude-3-haiku-20240307') -> 'anthropic'
  console.log("\nTest 6: getProviderForModel('claude-3-haiku-20240307') -> 'anthropic'");
  console.log(getProviderForModel('claude-3-haiku-20240307') === 'anthropic' ? "✅ Passed" : "❌ Failed");

  // Test 7: getProviderForModel('gpt-4o') -> 'openai'
  console.log("\nTest 7: getProviderForModel('gpt-4o') -> 'openai'");
  console.log(getProviderForModel('gpt-4o') === 'openai' ? "✅ Passed" : "❌ Failed");

  // Test 8: getProviderForModel('gemini-1.5-flash') -> 'google_gemini'
  console.log("\nTest 8: getProviderForModel('gemini-1.5-flash') -> 'google_gemini'");
  console.log(getProviderForModel('gemini-1.5-flash') === 'google_gemini' ? "✅ Passed" : "❌ Failed");

  console.log("\n✅ All tests completed.");
  process.exit(0);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
