const { validateDependencies, buildExecutionOrder, enrichSubtasks } = require('./decomposer');

function runTests() {
  console.log("🧪 Testing decomposer.js\n");

  // 1
  const t1 = [{ id: 1, dependsOn: [] }, { id: 2, dependsOn: [] }];
  const r1 = validateDependencies(JSON.parse(JSON.stringify(t1)));
  console.log("Test 1: validateDependencies with no deps");
  console.log(r1[0].dependsOn.length === 0 && r1[1].dependsOn.length === 0 ? "✅ Passed" : "❌ Failed");

  // 2
  const t2 = [{ id: 1, dependsOn: [] }, { id: 2, dependsOn: [1, 999] }];
  const r2 = validateDependencies(JSON.parse(JSON.stringify(t2)));
  console.log("Test 2: validateDependencies with missing dep reference");
  console.log(r2[1].dependsOn.length === 1 && r2[1].dependsOn[0] === 1 ? "✅ Passed" : "❌ Failed");

  // 3
  const t3 = [{ id: 1, dependsOn: [] }, { id: 2, dependsOn: [1, 3] }, { id: 3, dependsOn: [2] }];
  const r3 = validateDependencies(JSON.parse(JSON.stringify(t3)));
  console.log("Test 3: validateDependencies with circular dep");
  // One of the links should be removed. Let's just check if it's no longer circular
  const isCircular = r3[1].dependsOn.includes(3) && r3[2].dependsOn.includes(2);
  console.log(!isCircular ? "✅ Passed" : "❌ Failed");

  // 4
  const t4 = [{ id: 1, dependsOn: [] }, { id: 2, dependsOn: [] }];
  const r4 = buildExecutionOrder(t4);
  console.log("Test 4: buildExecutionOrder with independent tasks");
  console.log(r4.length === 1 && r4[0].length === 2 ? "✅ Passed" : "❌ Failed");

  // 5
  const t5 = [{ id: 1, dependsOn: [] }, { id: 2, dependsOn: [1] }, { id: 3, dependsOn: [2] }];
  const r5 = buildExecutionOrder(t5);
  console.log("Test 5: buildExecutionOrder with chain A->B->C");
  console.log(r5.length === 3 && r5[0][0]===1 && r5[1][0]===2 && r5[2][0]===3 ? "✅ Passed" : "❌ Failed");

  // 6
  const t6 = [{ id: 1, dependsOn: [] }, { id: 2, dependsOn: [1] }, { id: 3, dependsOn: [1] }, { id: 4, dependsOn: [2, 3] }];
  const r6 = buildExecutionOrder(t6);
  console.log("Test 6: buildExecutionOrder with diamond");
  console.log(r6.length === 3 && r6[1].includes(2) && r6[1].includes(3) && r6[2][0]===4 ? "✅ Passed" : "❌ Failed");

  // 7
  const availableModels = [{ id: "model-a", displayName: "Model A" }, { id: "model-b", displayName: "Model B" }];
  const t7 = [{ id: 1, assignedModel: "model-a", dependsOn: [] }, { id: 2, assignedModel: "model-b", dependsOn: [1] }];
  const r7 = enrichSubtasks(t7, availableModels);
  console.log("Test 7: enrichSubtasks");
  const t7Pass = r7[0].canRunInParallel === true && r7[0].wave === 0 && r7[0].modelDisplayName === "Model A" &&
                 r7[1].canRunInParallel === false && r7[1].wave === 1 && r7[1].modelDisplayName === "Model B";
  console.log(t7Pass ? "✅ Passed" : "❌ Failed");

  console.log("\n🧪 Testing Plan Versioning API endpoints\n");
  
  // To test the API, we will just call the handler directly with a mocked req/res to avoid starting the server, 
  // or start a mini express app just for the test.
  const express = require('express');
  const planRouter = require('../routes/plan');
  const app = express();
  app.use(express.json());
  app.use('/api', planRouter);
  
  const server = app.listen(0, async () => {
    try {
      const port = server.address().port;
      const crypto = require('crypto');
      const sessionId = crypto.randomUUID();
      
      // Setup mock data in Supabase directly
      const supabase = require('../db/supabase');
      const planId = crypto.randomUUID();
      
      // Mock the helpers to avoid DDL issues
      let mockPlanVersions = [];
      supabase.savePlanVersion = async (pId, sId, json, ver) => {
        const row = { plan_id: pId, session_id: sId, plan_json: json, plan_version: ver };
        mockPlanVersions.push(row);
        return { data: row, error: null };
      };
      
      supabase.getLatestPlan = async (pId) => {
        const plans = mockPlanVersions.filter(p => p.plan_id === pId);
        if (plans.length === 0) return { data: null, error: 'Not found' };
        plans.sort((a,b) => b.plan_version - a.plan_version);
        return { data: plans[0], error: null };
      };

      // 1. Insert session
      await supabase.from("sessions").upsert({
        id: sessionId,
        token_hash: crypto.randomBytes(32).toString("hex"),
        expires_at: new Date(Date.now() + 86400000).toISOString()
      });
      
      // 2. Insert valid key to get models
      await supabase.from("api_key_vault").insert([{
        session_id: sessionId,
        provider: "anthropic",
        encrypted_key: "mock",
        iv: "mock",
        auth_tag: "mock",
        key_hint: "mock",
        is_valid: true
      }]);
      
      // 3. Insert mock plan version 1
      const mockPlan = {
        subtasks: [{ id: 1, assignedModel: "claude-3-haiku-20240307", prompt: "Hello" }]
      };
      
      await supabase.savePlanVersion(planId, sessionId, mockPlan, 1);
      
      // Test 8: valid model reassignment
      const res8 = await fetch(`http://localhost:${port}/api/plan/${planId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          edits: [{ subtaskId: 1, field: 'assignedModel', value: 'claude-3-5-sonnet-20241022' }]
        })
      });
      const data8 = await res8.json();
      console.log("Test 8: POST /api/plan/:planId/edit with valid model reassignment");
      console.log(res8.status === 200 && data8.planVersion === 2 && data8.plan.subtasks[0].assignedModel === 'claude-3-5-sonnet-20241022' ? "✅ Passed" : "❌ Failed", data8.error || "");

      // Test 9: invalid model reassignment
      const res9 = await fetch(`http://localhost:${port}/api/plan/${planId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          edits: [{ subtaskId: 1, field: 'assignedModel', value: 'invalid-model' }]
        })
      });
      console.log("Test 9: POST /api/plan/:planId/edit with invalid model");
      console.log(res9.status === 400 ? "✅ Passed" : "❌ Failed");

    } catch (err) {
      console.error(err);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

runTests();
