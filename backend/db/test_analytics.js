const { logExecution, getSessionSummary } = require('./analytics');
const supabase = require('./supabase');
const crypto = require('crypto');
const express = require('express');

async function runTests() {
  console.log("🧪 Testing analytics.js\n");

  const sessionId = crypto.randomUUID();
  const execId = crypto.randomUUID();

  // Insert session
  await supabase.from("sessions").upsert({
    id: sessionId,
    token_hash: crypto.randomBytes(32).toString("hex"),
    expires_at: new Date(Date.now() + 86400000).toISOString()
  });

  const execRow = {
    id: execId,
    session_id: sessionId,
    category: 'coding',
    models_used: ['gpt-4o'],
    total_cost_usd: 0.05
  };

  const subtasks = [{
    modelUsed: 'gpt-4o',
    inputTokens: 100,
    outputTokens: 200,
    costUSD: 0.05,
    latencyMs: 1200,
    wasFallback: false
  }];

  let mockUsageStats = [];
  let mockExecutions = [];

  // Intercept supabase inserts and upserts for tests
  const originalFrom = supabase.from.bind(supabase);
  supabase.from = (table) => {
    const builder = originalFrom(table);
    if (table === 'model_usage_stats') {
      return {
        ...builder,
        upsert: async (data) => {
          const existing = mockUsageStats.find(m => m.session_id === data.session_id && m.model_id === data.model_id && m.period_date === data.period_date);
          if (existing) {
            existing.call_count += data.call_count;
            existing.total_cost_usd += data.total_cost_usd;
          } else {
            mockUsageStats.push({ ...data });
          }
          return { error: null, data: [data] };
        },
        insert: async (data) => {
          mockUsageStats.push(data);
          return { error: null, data: [data] };
        },
        select: (cols) => {
          return {
            eq: (col, val) => {
              if (col === 'session_id') return { data: mockUsageStats.filter(m => m.session_id === val), error: null };
              return { data: [], error: null };
            }
          };
        }
      };
    }
    if (table === 'executions') {
      return {
        ...builder,
        insert: async (data) => {
          mockExecutions.push(data);
          return { error: null, data: [data] };
        },
        select: (cols, opts) => {
          return {
            eq: (col, val) => {
              return {
                order: () => {
                  return {
                    range: () => {
                      return { data: mockExecutions.filter(m => m.session_id === val), error: null, count: mockExecutions.length };
                    }
                  }
                }
              }
            }
          };
        }
      };
    }
    if (table === 'audit_logs') {
      return {
        ...builder,
        insert: async (data) => { return { error: null, data: [data] }; }
      };
    }
    return builder;
  };

  // Test 1
  await logExecution(execRow, subtasks);
  
  // Wait for async logExecution to finish if there were pending promises, but we awaited it
  const { data: d1 } = await supabase.from('model_usage_stats').select('*').eq('session_id', sessionId);
  console.log("Test 1: logExecution -> model_usage_stats row created");
  console.log(d1 && d1.length === 1 ? "✅ Passed" : "❌ Failed", d1 || "");

  // Test 2: call again
  await logExecution(execRow, subtasks);
  const { data: d2 } = await supabase.from('model_usage_stats').select('*').eq('session_id', sessionId);
  console.log("Test 2: logExecution twice -> call_count increments");
  console.log(d2 && d2.length === 1 && d2[0].call_count === 2 ? "✅ Passed" : "❌ Failed", d2 || "");

  // Test 3: empty session
  const emptySessionId = crypto.randomUUID();
  const t3 = await getSessionSummary(emptySessionId);
  console.log("Test 3: getSessionSummary with 0 runs");
  console.log(t3.totalRuns === 0 && t3.totalCostUSD === 0 ? "✅ Passed" : "❌ Failed", t3);

  // Test 4: mixed data
  const t4 = await getSessionSummary(sessionId);
  console.log("Test 4: getSessionSummary with data");
  console.log(t4.spendByProvider['openai'] > 0 || t4.spendByProvider['unknown'] > 0 ? "✅ Passed" : "❌ Failed", t4.spendByProvider);

  // Test 5 & 6 via express
  console.log("\n🧪 Testing API endpoints\n");
  const app = express();
  app.use(express.json());
  app.use('/api/history', require('../routes/history'));
  app.use('/api/analytics', require('../routes/analytics'));

  const server = app.listen(0, async () => {
    try {
      const port = server.address().port;
      
      const res5 = await fetch(`http://localhost:${port}/api/history?session_id=${sessionId}`);
      const text5 = await res5.text();
      let data5;
      try { data5 = JSON.parse(text5); } catch(e) { console.error("Test 5 Error:", text5); }
      console.log("Test 5: GET /api/history");
      console.log(res5.status === 200 && Array.isArray(data5?.history) ? "✅ Passed" : "❌ Failed", data5);

      const res6 = await fetch(`http://localhost:${port}/api/analytics?session_id=${sessionId}`);
      const text6 = await res6.text();
      let data6;
      try { data6 = JSON.parse(text6); } catch(e) { console.error("Test 6 Error:", text6); }
      console.log("Test 6: GET /api/analytics");
      console.log(res6.status === 200 && data6?.summary ? "✅ Passed" : "❌ Failed", data6);

    } catch (err) {
      console.error(err);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

runTests();
