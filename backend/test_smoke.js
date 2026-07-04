process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'local-smoke-test-secret';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'dummy-service-key';

const assert = require('assert');
const { encryptKey, decryptKey } = require('./security/vault');
const { classifyPrompt } = require('./core/classifier');
const { estimateTokensAndCost } = require('./core/token_counter');
const { validatePlanModels } = require('./core/router');
const { aggregateResults, scoreResponse, getFallbackModels } = require('./core/executor');
const { requireValidSessionId } = require('./core/validation');

function testVault() {
  const encrypted = encryptKey('sk-test-1234');
  assert.notStrictEqual(encrypted, 'sk-test-1234');
  assert.strictEqual(decryptKey(encrypted), 'sk-test-1234');
}

function testClassifier() {
  const result = classifyPrompt('Build and test a React backend API integration step by step');
  assert.strictEqual(result.category, 'coding');
  assert(['medium', 'hard', 'agentic'].includes(result.difficulty));
  assert.strictEqual(result.needsDecomposition, true);
}

function testEstimator() {
  const estimate = estimateTokensAndCost('Hello world', {
    cost_per_1k_input: 0.001,
    cost_per_1k_output: 0.002,
    avg_latency_ms: 500,
  });
  assert(estimate.tokens > 0);
  assert(estimate.cost >= 0);
  assert(estimate.timeSeconds >= 1);
}

function testPlanValidator() {
  const plan = {
    subtasks: [{ id: 1, title: 'Task', assignedModel: 'gpt-4o-mini', prompt: 'Do it' }],
    totalEstimate: { tokens: 100, cost: 0.001, timeSeconds: 2 },
  };
  assert.strictEqual(validatePlanModels(plan, ['gpt-4o-mini']), true);
  assert.throws(() => validatePlanModels(plan, ['claude-3-haiku-20240307']), /unavailable model/);
}

function testExecutorHelpers() {
  const output = aggregateResults('Prompt', [
    { id: 1, title: 'One', model: 'gpt-4o-mini', output: 'Answer one', usedFallback: false },
    { id: 2, title: 'Two', model: 'claude-3-haiku-20240307', output: 'Answer two', usedFallback: true },
  ]);
  assert(output.includes('# Final Response'));
  assert(output.includes('fallback used'));

  const score = scoreResponse('One', 'One complete useful answer with detail.'.repeat(30), false, null);
  assert(score.score > 70);

  const fallbacks = getFallbackModels('b', [
    { id: 'a', provider: 'openai', cost_per_1k_input: 1, cost_per_1k_output: 1 },
    { id: 'b', provider: 'anthropic', cost_per_1k_input: 2, cost_per_1k_output: 2 },
  ], new Map([['openai', 'x'], ['anthropic', 'y']]));
  assert.strictEqual(fallbacks[0].id, 'b');
}

function testValidation() {
  assert.strictEqual(requireValidSessionId('11111111-1111-4111-8111-111111111111'), null);
  assert.strictEqual(requireValidSessionId('not-a-uuid'), 'session_id must be a valid UUID');
}

function run() {
  testVault();
  testClassifier();
  testEstimator();
  testPlanValidator();
  testExecutorHelpers();
  testValidation();
  console.log('✅ smoke tests passed');
}

run();
