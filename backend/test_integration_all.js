const assert = require('assert');
process.env.ENCRYPTION_KEY = "mock_secret_key_32_characters_ok";

// 1. Mock Vault to return dummy decrypted keys
const mockVault = {
  decryptKey: (key) => 'mock-decrypted-api-key',
  encryptKey: (key) => 'mock-encrypted-api-key'
};
require('./security/vault'); // pre-load
require.cache[require.resolve('./security/vault')].exports = mockVault;

let lastLlmPrompt = '';

// 1b. Mock OpenAI client to return mock plan
const mockOpenAI = function() {
  this.chat = {
    completions: {
      create: async (params) => {
        lastLlmPrompt = params.messages?.[1]?.content || '';
        return {
          choices: [{
            message: {
              content: JSON.stringify({
                category: 'coding',
                difficulty: 'easy',
                needsDecomposition: false,
                subtasks: [
                  { id: 1, title: 'Mock task', assignedModel: 'gpt-4o-mini', prompt: 'Task prompt', dependsOn: [] }
                ],
                memorableFacts: ['User wants python']
              })
            }
          }]
        };
      }
    }
  };
};
require.cache[require.resolve('openai')] = { exports: mockOpenAI };

// 2. Mock Supabase for clean testing
const mockRows = {};
const mockSupabase = {
  from: (table) => {
    const query = {
      select: () => query,
      eq: (col, val) => {
        query._eqVal = val;
        return query;
      },
      order: () => query,
      limit: () => query,
      is: () => query,
      single: async () => {
        const val = mockRows[query._eqVal];
        if (!val) return { error: { code: 'PGRST116', message: 'No rows' } };
        return { data: { context: val } };
      },
      upsert: async (row) => {
        mockRows[row.session_id] = row.context;
        return { error: null };
      },
      // support database array results (e.g. select from api_key_vault)
      then: (resolve) => {
        if (table === 'api_key_vault') {
          resolve({ data: [{ encrypted_key: 'mock-encrypted-api-key' }], error: null });
        } else {
          resolve({ data: [], error: null });
        }
      }
    };
    return query;
  }
};

// Require our modules (temporarily override database/supabase in cache)
require('./db/supabase'); // load it
require.cache[require.resolve('./db/supabase')].exports = mockSupabase;

const { readContext, writeContext } = require('./core/memory');
const { generatePlan } = require('./core/router');
const { executePlan } = require('./core/executor');

// Mock LLM provider call
const originalCallLLMProvider = require('./core/executor').callLLMProvider;
require.cache[require.resolve('./core/executor')].exports.callLLMProvider = async (provider, modelId, apiKey, prompt) => {
  return {
    text: `Response for: ${prompt.substring(0, 30)}...`,
    usage: { input_tokens: 10, output_tokens: 20 }
  };
};

async function testMemoryModule() {
  console.log('Testing Memory Module...');
  const sessionId = 'test-session-uuid';

  // 1. Empty read
  const empty = await readContext(sessionId);
  assert.deepStrictEqual(empty, { facts: [], decisions: [] }, 'Empty read failed');

  // 2. Write and Read
  await writeContext(sessionId, { facts: ['Fact A'], decisions: ['Decision A'] });
  const context = await readContext(sessionId);
  assert.deepStrictEqual(context, { facts: ['Fact A'], decisions: ['Decision A'] }, 'Read after write failed');

  // 3. Merging + Truncation limits
  const facts = Array.from({ length: 60 }, (_, i) => `Fact ${i}`);
  const decisions = Array.from({ length: 25 }, (_, i) => `Decision ${i}`);
  await writeContext(sessionId, { facts, decisions });

  const finalCtx = await readContext(sessionId);
  assert.strictEqual(finalCtx.facts.length, 50, 'Facts cap not enforced');
  assert.strictEqual(finalCtx.decisions.length, 20, 'Decisions cap not enforced');
  assert.strictEqual(finalCtx.facts[0], 'Fact 10', 'First fact should be Fact 10 after truncation');
  assert.strictEqual(finalCtx.decisions[0], 'Decision 5', 'First decision should be Decision 5 after truncation');

  console.log('✅ Memory Module tests passed!');
}

async function testRouter() {
  console.log('\nTesting Router...');
  const availableModels = ['gpt-4o-mini'];
  const sessionId = 'test-session-uuid';

  const plan = await generatePlan(
    'My Prompt',
    availableModels,
    sessionId,
    [{ prompt: 'Old prompt', resultSummary: 'Old summary' }],
    { facts: ['Known Fact 1'], decisions: [] }
  );

  // Check prefix order: known context → history → current prompt
  assert(lastLlmPrompt.includes('Known context:\nKnown Fact 1'), 'Known context missing or in wrong order');
  assert(lastLlmPrompt.includes('Conversation so far:\nTurn 1 — user: Old prompt, summary: Old summary'), 'History missing or in wrong order');
  assert(lastLlmPrompt.includes('My Prompt'), 'Current prompt missing');

  // Verify memorableFacts is normalized and returned
  assert.deepStrictEqual(plan.memorableFacts, ['User wants python'], 'memorableFacts mapping failed');

  console.log('✅ Router tests passed!');
}

async function testExecutor() {
  console.log('\nTesting Executor...');

  // 1. Same wave dependency is self-healed by the executor
  const badPlan = {
    category: 'general',
    subtasks: [
      { id: 1, wave: 0, prompt: 'Task A', assignedModel: 'gpt-4o-mini', dependsOn: [2] },
      { id: 2, wave: 0, prompt: 'Task B', assignedModel: 'gpt-4o-mini', dependsOn: [] }
    ]
  };

  const repairResult = await executePlan(badPlan, { openai: 'mock-key' }, [{ id: 'gpt-4o-mini' }]);
  assert.strictEqual(repairResult.status, 'completed');
  assert.strictEqual(repairResult.subtaskResults[0].subtaskId, 2); // Task B (no deps) must run first
  assert.strictEqual(repairResult.subtaskResults[1].subtaskId, 1); // Task A (depends on B) must run second

  // 2. Concurrency and order preservation
  const goodPlan = {
    category: 'general',
    subtasks: [
      { id: 1, wave: 0, prompt: 'Task A', assignedModel: 'gpt-4o-mini', dependsOn: [] },
      { id: 2, wave: 0, prompt: 'Task B', assignedModel: 'gpt-4o-mini', dependsOn: [] },
      { id: 3, wave: 1, prompt: 'Task C', assignedModel: 'gpt-4o-mini', dependsOn: [1] }
    ],
    memorableFacts: ['New Fact worth remembering']
  };

  const sessionId = 'test-session-uuid';
  // Seed database context
  mockRows[sessionId] = { facts: ['Prior Fact'], decisions: [] };

  const result = await executePlan(goodPlan, { openai: 'mock-key' }, [{ id: 'gpt-4o-mini' }], sessionId);

  // Order preserved (1, 2, 3)
  assert.strictEqual(result.subtaskResults[0].subtaskId, 1);
  assert.strictEqual(result.subtaskResults[1].subtaskId, 2);
  assert.strictEqual(result.subtaskResults[2].subtaskId, 3);
  assert.strictEqual(result.status, 'completed');

  // Context written back
  const finalCtx = await readContext(sessionId);
  assert(finalCtx.facts.includes('New Fact worth remembering'), 'Memorable facts were not written to context');

  console.log('✅ Executor tests passed!');
}

async function runAll() {
  try {
    await testMemoryModule();
    await testRouter();
    await testExecutor();
    console.log('\n🌟 ALL INTEGRATION TESTS PASSED PERFECTLY!');
  } catch (err) {
    console.error('\n❌ Test execution failed:', err);
    process.exit(1);
  }
}

runAll();
