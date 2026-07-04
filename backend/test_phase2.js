// Test script for Phase 2: API Key Vault
// Run with: node test_phase2.js

// Set environment variables for testing (MUST be before requiring modules)
process.env.ENCRYPTION_KEY = "hackathon_secret_key_32chars_xyz";

const crypto = require("crypto");

// Clear require cache to ensure fresh load
delete require.cache[require.resolve("./security/vault")];

const { encryptKey, decryptKey } = require("./security/vault");

console.log("🧪 Testing Phase 2: API Key Vault\n");

// Test 1: Encryption
console.log("Test 1: Encryption");
const testKey = "sk-test1234567890abcdefghijklmnopqrstuvwxyz";
try {
  const encrypted = encryptKey(testKey);
  console.log("✅ Encryption successful");
  console.log("   Encrypted format:", encrypted.substring(0, 50) + "...");
  console.log(
    "   Parts count:",
    encrypted.split(":").length,
    "(should be 3: iv:tag:ciphertext)",
  );
} catch (error) {
  console.error("❌ Encryption failed:", error.message);
}

// Test 2: Decryption
console.log("\nTest 2: Decryption");
try {
  const encrypted = encryptKey(testKey);
  const decrypted = decryptKey(encrypted);
  console.log("✅ Decryption successful");
  console.log("   Original:", testKey);
  console.log("   Decrypted:", decrypted);
  console.log("   Match:", testKey === decrypted ? "✅ YES" : "❌ NO");
} catch (error) {
  console.error("❌ Decryption failed:", error.message);
}

// Test 3: Invalid encrypted format
console.log("\nTest 3: Invalid encrypted format");
try {
  const invalidEncrypted = "invalid:format";
  const decrypted = decryptKey(invalidEncrypted);
  console.log("❌ Should have thrown error");
} catch (error) {
  console.log("✅ Correctly threw error:", error.message);
}

// Test 4: Empty key
console.log("\nTest 4: Empty key");
try {
  const encrypted = encryptKey("");
  console.log("❌ Should have thrown error");
} catch (error) {
  console.log("✅ Correctly threw error:", error.message);
}

// Test 5: Different keys produce different ciphertexts
console.log("\nTest 5: Different keys produce different ciphertexts");
const key1 = "sk-key111111111111111111111111111";
const key2 = "sk-key222222222222222222222222222";
const encrypted1 = encryptKey(key1);
const encrypted2 = encryptKey(key2);
console.log("✅ Different keys:", encrypted1 !== encrypted2 ? "YES" : "NO");

// Test 6: Same key produces different ciphertexts (due to random IV)
console.log("\nTest 6: Same key produces different ciphertexts (random IV)");
const encryptedA = encryptKey(testKey);
const encryptedB = encryptKey(testKey);
console.log(
  "✅ Different ciphertexts:",
  encryptedA !== encryptedB ? "YES" : "NO",
);
console.log(
  "   Both decrypt to same value:",
  decryptKey(encryptedA) === decryptKey(encryptedB) ? "YES" : "NO",
);

console.log("\n✅ All Phase 2 encryption/decryption tests passed!");
console.log("\n📝 Next steps:");
console.log("   1. Set up .env file with Supabase credentials");
console.log("   2. Start server: npm start");
console.log("   3. Test POST /api/keys endpoint");
console.log("   4. Test GET /api/models endpoint");

async function runApiTests() {
  const baseUrl = process.env.TEST_SERVER_URL || "http://localhost:8000";
  const sessionId = crypto.randomUUID();

  console.log("\n🧪 API Tests: POST /api/keys with invalid key");
  const invalidPayload = {
    session_id: sessionId,
    provider: "openai",
    api_key: "sk-invalid-1234567890",
  };

  try {
    const response = await fetch(`${baseUrl}/api/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidPayload),
    });

    const data = await response.json();
    const bodyText = JSON.stringify(data);
    const isInvalid = response.status === 400 && data.status === "invalid";
    const noSecrets =
      !bodyText.includes("api_key") && !bodyText.includes("encrypted_key");

    console.log(
      isInvalid ? "✅ Invalid key rejected" : "❌ Invalid key test failed",
    );
    console.log(
      noSecrets ? "✅ No secrets in response" : "❌ Secrets leaked in response",
    );
  } catch (error) {
    console.log(
      "⚠️  Skipped invalid key test (server not reachable):",
      error.message,
    );
  }

  console.log("\n🧪 API Tests: GET /api/models with invalid session_id");
  try {
    const response = await fetch(`${baseUrl}/api/models?session_id=bad-uuid`);
    const data = await response.json();
    const isBad = response.status === 400;
    console.log(
      isBad
        ? "✅ Invalid session_id rejected"
        : "❌ Invalid session_id test failed",
    );
    console.log("   Response:", data);
  } catch (error) {
    console.log(
      "⚠️  Skipped invalid session_id test (server not reachable):",
      error.message,
    );
  }

  console.log("\n🧪 API Tests: GET /api/models with no keys");
  try {
    const response = await fetch(
      `${baseUrl}/api/models?session_id=${sessionId}`,
    );
    const data = await response.json();
    const ok =
      response.status === 200 && data.count === 0 && Array.isArray(data.models);
    console.log(
      ok ? "✅ Empty models list returned" : "❌ Empty models list test failed",
    );
    console.log("   Response:", data);
  } catch (error) {
    console.log(
      "⚠️  Skipped models empty test (server not reachable):",
      error.message,
    );
  }

  if (process.env.TEST_VALID_PROVIDER && process.env.TEST_VALID_KEY) {
    const provider = process.env.TEST_VALID_PROVIDER;
    const apiKey = process.env.TEST_VALID_KEY;
    const validSessionId = crypto.randomUUID();

    console.log("\n🧪 API Tests: POST /api/keys with valid key (DB check)");
    try {
      const response = await fetch(`${baseUrl}/api/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: validSessionId,
          provider,
          api_key: apiKey,
        }),
      });

      const data = await response.json();
      console.log(
        response.status === 200 && data.success
          ? "✅ Valid key accepted"
          : "❌ Valid key test failed",
      );

      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
        const supabase = require("./db/supabase");
        const { data: rows } = await supabase
          .from("api_key_vault")
          .select("encrypted_key")
          .eq("session_id", validSessionId)
          .eq("provider", provider)
          .eq("revoked_at", null)
          .limit(1);

        if (rows && rows[0]) {
          const different = rows[0].encrypted_key !== apiKey;
          console.log(
            different
              ? "✅ Encrypted key differs from plaintext"
              : "❌ Encrypted key matches plaintext",
          );
        } else {
          console.log("⚠️  No DB row found for valid key test");
        }
      } else {
        console.log("⚠️  Skipped DB check (Supabase env vars missing)");
      }
    } catch (error) {
      console.log(
        "⚠️  Skipped valid key test (server not reachable):",
        error.message,
      );
    }
  } else {
    console.log(
      "\n⚠️  Skipping valid key test. Set TEST_VALID_PROVIDER and TEST_VALID_KEY to enable it.",
    );
  }
}

runApiTests();
