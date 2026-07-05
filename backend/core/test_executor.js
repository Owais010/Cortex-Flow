const { getFallbackOrder } = require('./fallback');
const { executePlan } = require('./executor');
const { getAvailableModels } = require('../db/models');

async function test() {
  console.log("🧪 Testing fallback logic...");
  
  const availableModels = [
    { id: 'gpt-4o' },
    { id: 'gpt-4o-mini' },
    { id: 'claude-3-5-sonnet-20241022' }
  ];

  // Test 1: getFallbackOrder keeps the assigned model first and includes fallbacks
  const order = getFallbackOrder('coding', 'gpt-4o', availableModels);
  console.log("Fallback order for coding (gpt-4o):", order);
  const t1Pass = order[0] === 'gpt-4o' && order.length > 1;
  console.log(t1Pass ? "✅ Passed" : "❌ Failed");

  // Test 2: single-provider (Gemini-only) users get a real same-provider chain
  const geminiOnly = [
    { id: 'gemini-2.5-pro' },
    { id: 'gemini-2.5-flash' },
    { id: 'gemini-2.0-flash' }
  ];
  const geminiOrder = getFallbackOrder('research', 'gemini-2.5-pro', geminiOnly);
  console.log("Fallback order for research (gemini-2.5-pro):", geminiOrder);
  const t2Pass = geminiOrder[0] === 'gemini-2.5-pro' && geminiOrder.length >= 2;
  console.log(t2Pass ? "✅ Passed" : "❌ Failed — Gemini-only user has no fallback!");

  console.log("\n🧪 Testing syntax for executor.js and routes/execute.js...");
}

test();
