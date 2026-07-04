const { getFallbackOrder } = require('./fallback');
const { executePlan } = require('./executor');
const { getAvailableModels } = require('../db/models');

async function test() {
  console.log("🧪 Testing fallback logic...");
  
  const availableModels = [
    { id: 'gpt-4o' },
    { id: 'claude-3-haiku-20240307' },
    { id: 'gemini-1.5-flash' }
  ];

  // Test 1: getFallbackOrder
  const order = getFallbackOrder('coding', 'gpt-4o', availableModels);
  console.log("Fallback order for coding (gpt-4o):", order);
  const t1Pass = order[0] === 'gpt-4o' && order.length > 1;
  console.log(t1Pass ? "✅ Passed" : "❌ Failed");

  console.log("\n🧪 Testing syntax for executor.js and routes/execute.js...");
}

test();
