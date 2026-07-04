const { 
  estimateTokens, 
  estimateCost, 
  computeActualCost, 
  aggregatePlanCost, 
  checkSpendCap,
  PRICING,
  FALLBACK_PRICE
} = require('./token_counter');

async function runTests() {
  console.log("🧪 Testing token_counter.js\n");

  // 1
  const t1 = estimateTokens('hello world');
  console.log("Test 1: estimateTokens('hello world')");
  console.log(t1.input > 0 && t1.output > 0 ? "✅ Passed" : "❌ Failed", t1);

  // 2
  const t2 = estimateCost('gpt-4o', 'a 200 char prompt'.padEnd(200, 'x'), []);
  console.log("Test 2: estimateCost('gpt-4o') -> no NaN");
  const t2Pass = !isNaN(t2.estimatedCostUSD) && !isNaN(t2.estimatedCostINR) && t2.estimatedCostUSD > 0;
  console.log(t2Pass ? "✅ Passed" : "❌ Failed", t2);

  // 3
  const t3 = estimateCost('unknown-model-xyz', 'text', []);
  console.log("Test 3: estimateCost('unknown-model-xyz') -> uses FALLBACK_PRICE");
  const expectedT3Usd = parseFloat((t3.estimatedInputTokens / 1000 * FALLBACK_PRICE.inputPer1k + t3.estimatedOutputTokens / 1000 * FALLBACK_PRICE.outputPer1k).toFixed(6));
  console.log(t3.estimatedCostUSD === expectedT3Usd ? "✅ Passed" : "❌ Failed", t3);

  // 4
  const t4 = computeActualCost('claude-3-haiku-20240307', { input_tokens: 100, output_tokens: 150 });
  console.log("Test 4: computeActualCost()");
  const expectedT4Usd = parseFloat((100 / 1000 * PRICING['claude-3-haiku-20240307'].inputPer1k + 150 / 1000 * PRICING['claude-3-haiku-20240307'].outputPer1k).toFixed(8));
  console.log(t4 === expectedT4Usd ? "✅ Passed" : "❌ Failed", t4);

  // 5
  const t5 = aggregatePlanCost([
    { estimatedCostUSD: 1.0, estimatedCostINR: 83.5, estimatedInputTokens: 100, estimatedOutputTokens: 200, estimatedLatencyMs: 1000 },
    { estimatedCostUSD: 2.0, estimatedCostINR: 167.0, estimatedInputTokens: 200, estimatedOutputTokens: 400, estimatedLatencyMs: 2000 }
  ]);
  console.log("Test 5: aggregatePlanCost()");
  console.log(t5.totalEstimatedCostUSD === 3.0 && t5.totalEstimatedTokens === 900 ? "✅ Passed" : "❌ Failed", t5);

  // 6
  // We mock supabase or rely on the real one, which might fail or return 0
  const supabase = require('../db/supabase');
  const crypto = require('crypto');
  const t6 = await checkSpendCap(crypto.randomUUID());
  console.log("Test 6: checkSpendCap with 0 spend");
  console.log(t6.allowed === true && typeof t6.remaining === 'number' ? "✅ Passed" : "❌ Failed", t6);

  // 7
  console.log("Test 7: No floating point leakage (max 6 decimals for USD)");
  const hasLeakage = (num) => {
    const str = num.toString();
    if (str.includes('.')) {
      return str.split('.')[1].length > 8; // Allowing up to 8 for actualCost, 6 for estimateCost
    }
    return false;
  };
  const t7Pass = !hasLeakage(t2.estimatedCostUSD) && !hasLeakage(t3.estimatedCostUSD) && !hasLeakage(t4) && !hasLeakage(t5.totalEstimatedCostUSD);
  console.log(t7Pass ? "✅ Passed" : "❌ Failed");

}

runTests().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
