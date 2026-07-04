/**
 * Smoke Test Suite — Full Demo Path
 * 
 * Runs the entire main demo path from start to finish using real API calls.
 * Usage: node test/smoke_test.js
 * 
 * Required env vars (set in .env or export before running):
 *   SMOKE_OPENAI_KEY     — A valid OpenAI API key
 *   SMOKE_ANTHROPIC_KEY  — A valid Anthropic API key
 */

const crypto = require('crypto');

// Load env
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const BASE_URL = `http://localhost:${process.env.PORT || 8000}`;
const SESSION_ID = crypto.randomUUID();

const OPENAI_KEY = process.env.SMOKE_OPENAI_KEY;
const ANTHROPIC_KEY = process.env.SMOKE_ANTHROPIC_KEY;

const results = [];
let storedPlanId = null;
let storedModels = [];

function log(step, label, passed, detail) {
  results.push({ step, label, passed });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} Step ${step} — ${label}: ${passed ? 'PASSED' : 'FAILED'}`);
  if (detail && !passed) console.log('   Detail:', typeof detail === 'object' ? JSON.stringify(detail, null, 2) : detail);
}

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

async function step1_submitKeys() {
  console.log('\n--- Step 1: Submit API Keys ---');
  
  if (!OPENAI_KEY || !ANTHROPIC_KEY) {
    log(1, 'Key submission', false, 'Missing SMOKE_OPENAI_KEY or SMOKE_ANTHROPIC_KEY env vars');
    return false;
  }

  const r1 = await post('/api/keys', {
    session_id: SESSION_ID,
    provider: 'openai',
    api_key: OPENAI_KEY
  });

  const r2 = await post('/api/keys', {
    session_id: SESSION_ID,
    provider: 'anthropic',
    api_key: ANTHROPIC_KEY
  });

  const pass = r1.data?.status === 'active' && r2.data?.status === 'active';
  log(1, 'Key submission', pass, { openai: r1.data, anthropic: r2.data });
  return pass;
}

async function step2_verifyModels() {
  console.log('\n--- Step 2: Verify Model Discovery ---');
  
  const r = await get(`/api/models?session_id=${SESSION_ID}`);
  const models = r.data?.models || [];
  storedModels = models;

  const hasEnough = models.length >= 2;
  const allHaveFields = models.every(m => m.id && m.provider);

  const pass = hasEnough && allHaveFields;
  log(2, 'Model discovery', pass, { count: models.length, sample: models[0] });
  return pass;
}

async function step3_generatePlan() {
  console.log('\n--- Step 3: Generate a Plan ---');
  
  const r = await post('/api/plan', {
    session_id: SESSION_ID,
    prompt: 'Explain how neural networks learn, then write a Python example of gradient descent'
  });

  const plan = r.data?.plan;
  if (!plan) {
    log(3, 'Plan generation', false, r.data);
    return false;
  }

  storedPlanId = plan.planId;

  const hasPlanId = typeof plan.planId === 'string' && plan.planId.length > 0;
  const hasSubtasks = Array.isArray(plan.subtasks) && plan.subtasks.length >= 1;
  const hasCost = typeof plan.totalEstimatedCostUSD === 'number' && !isNaN(plan.totalEstimatedCostUSD);
  const hasCategory = typeof plan.category === 'string';
  const hasDifficulty = typeof plan.difficulty === 'string';
  const hasDecomp = typeof plan.needsDecomposition === 'boolean';
  const hasSessionId = plan.sessionId === SESSION_ID;

  // Every subtask.assignedModel should be in the models list
  const modelIds = new Set(storedModels.map(m => m.id));
  const allModelsValid = plan.subtasks.every(t => modelIds.has(t.assignedModel));

  // Each subtask should have required fields
  const subtaskFields = plan.subtasks.every(t =>
    t.id !== undefined && t.title && t.assignedModel && t.prompt
  );

  const pass = hasPlanId && hasSubtasks && hasCost && hasCategory && hasDifficulty && hasDecomp && hasSessionId && allModelsValid && subtaskFields;
  log(3, 'Plan generation', pass, {
    planId: plan.planId,
    category: plan.category,
    difficulty: plan.difficulty,
    subtaskCount: plan.subtasks?.length,
    totalCost: plan.totalEstimatedCostUSD,
    allModelsValid,
    subtaskFields
  });
  return pass;
}

async function step4_executePlan() {
  console.log('\n--- Step 4: Execute the Plan ---');
  
  if (!storedPlanId) {
    log(4, 'Plan execution', false, 'No planId from step 3');
    return false;
  }

  const r = await post('/api/execute', {
    session_id: SESSION_ID,
    plan_id: storedPlanId
  });

  const result = r.data?.result;
  if (!result) {
    log(4, 'Plan execution', false, r.data);
    return false;
  }

  const validStatus = result.status === 'completed' || result.status === 'partial';
  const hasOutput = typeof result.finalOutput === 'string' && result.finalOutput.length > 50;
  const hasCost = typeof result.totalCostUSD === 'number' && result.totalCostUSD > 0;
  const hasResults = Array.isArray(result.subtaskResults) && result.subtaskResults.length >= 1;
  const allResultsValid = result.subtaskResults.every(r =>
    r.modelUsed && r.output && typeof r.inputTokens === 'number'
  );

  const pass = validStatus && hasOutput && hasCost && hasResults && allResultsValid;
  log(4, 'Plan execution', pass, {
    status: result.status,
    outputLength: result.finalOutput?.length,
    totalCostUSD: result.totalCostUSD,
    subtaskCount: result.subtaskResults?.length,
    allResultsValid
  });
  return pass;
}

async function step5_verifyAnalytics() {
  console.log('\n--- Step 5: Verify Analytics Recorded ---');
  
  const r = await get(`/api/analytics?session_id=${SESSION_ID}`);
  const summary = r.data?.summary;

  if (!summary) {
    log(5, 'Analytics recorded', false, r.data);
    return false;
  }

  const hasRuns = summary.totalRuns >= 1;
  const hasCost = summary.totalCostUSD > 0;

  const pass = hasRuns && hasCost;
  log(5, 'Analytics recorded', pass, {
    totalRuns: summary.totalRuns,
    totalCostUSD: summary.totalCostUSD,
    spendByProvider: summary.spendByProvider
  });
  return pass;
}

async function step6_verifyHistory() {
  console.log('\n--- Step 6: Verify History Recorded ---');
  
  const r = await get(`/api/history?session_id=${SESSION_ID}`);
  const history = r.data?.history;

  if (!history) {
    log(6, 'History recorded', false, r.data);
    return false;
  }

  const hasEntries = history.length >= 1;
  const validStatus = history.length > 0 && (history[0].status === 'completed' || history[0].status === 'partial');

  const pass = hasEntries && validStatus;
  log(6, 'History recorded', pass, {
    historyCount: history.length,
    latestStatus: history[0]?.status
  });
  return pass;
}

async function run() {
  console.log('🧪 BYO-LLM Smoke Test Suite');
  console.log(`   Base URL:    ${BASE_URL}`);
  console.log(`   Session ID:  ${SESSION_ID}`);
  console.log(`   OpenAI Key:  ${OPENAI_KEY ? '***' + OPENAI_KEY.slice(-4) : 'MISSING'}`);
  console.log(`   Anthropic:   ${ANTHROPIC_KEY ? '***' + ANTHROPIC_KEY.slice(-4) : 'MISSING'}`);

  // Check server is up
  try {
    const health = await get('/health');
    if (health.data?.status !== 'ok') throw new Error('Server not healthy');
  } catch (e) {
    console.error('\n❌ Cannot connect to server at', BASE_URL);
    console.error('   Start the server first: npm start');
    process.exit(1);
  }

  const steps = [
    step1_submitKeys,
    step2_verifyModels,
    step3_generatePlan,
    step4_executePlan,
    step5_verifyAnalytics,
    step6_verifyHistory
  ];

  for (const step of steps) {
    const passed = await step();
    if (!passed) {
      console.log('\n💥 FAIL FAST — stopping at first failure');
      break;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('SMOKE TEST SUMMARY');
  console.log('='.repeat(50));
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`  ${icon} Step ${r.step} — ${r.label}: ${r.passed ? 'PASSED' : 'FAILED'}`);
  }

  const allPassed = results.every(r => r.passed);
  if (allPassed) {
    console.log('\n🎉 All 6 steps passed — backend is demo-ready!\n');
  } else {
    console.log(`\n💥 ${results.filter(r => !r.passed).length} step(s) failed\n`);
  }

  process.exit(allPassed ? 0 : 1);
}

run().catch(err => {
  console.error('Fatal error in smoke test:', err);
  process.exit(1);
});
