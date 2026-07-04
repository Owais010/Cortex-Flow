const express = require('express');
const { z } = require('zod');
const crypto = require('crypto');

const validate = require('../middleware/validate');
const { getAvailableModels } = require('../db/models');
const { generatePlan } = require('../core/router');
const { estimateTokensAndCost } = require('../core/token_counter');
const supabase = require('../db/supabase');
const { savePlan, getPlan } = require('../core/plan_store');

const router = express.Router();

const planSchema = z.object({
  session_id: z.string().uuid(),
  prompt: z.string().min(1).max(10000),
  available_models: z.array(z.string()).optional()
});

router.post('/', validate(planSchema), async (req, res, next) => {
  try {
    const { session_id, prompt, available_models } = req.body;

    const availableModels = await getAvailableModels(session_id);
    const availableModelIds = availableModels.map((m) => m.id);
    const resolvedModelIds = Array.isArray(available_models) && available_models.length > 0
      ? available_models.filter((id) => availableModelIds.includes(id))
      : availableModelIds;

    if (resolvedModelIds.length === 0) {
      return res.status(400).json({
        error: 'No API keys connected. Submit at least one key via POST /api/keys.'
      });
    }

    const generated = await generatePlan(prompt, resolvedModelIds, session_id);
    const subtasks = generated.subtasks.map((task) => {
      const estimate = estimateTokensAndCost(task.prompt, task.assignedModel);
      return {
        id: task.id,
        title: task.title,
        assignedModel: task.assignedModel,
        modelReasoning: task.modelReasoning || null,
        prompt: task.prompt,
        dependsOn: task.dependsOn || [],
        estimatedTokens: estimate.tokens,
        estimatedCost: estimate.cost,
        estimatedTime: estimate.timeSeconds
      };
    });

    const totals = subtasks.reduce((acc, task) => {
      acc.tokens += task.estimatedTokens || 0;
      acc.cost += task.estimatedCost || 0;
      acc.timeSeconds += task.estimatedTime || 0;
      return acc;
    }, { tokens: 0, cost: 0, timeSeconds: 0 });

    const plan = {
      planId: crypto.randomUUID(),
      prompt,
      category: generated.category,
      difficulty: generated.difficulty,
      needsDecomposition: generated.needsDecomposition,
      decompositionReasoning: generated.decompositionReasoning || null,
      availableModels: resolvedModelIds,
      subtasks,
      totalEstimate: {
        tokens: totals.tokens,
        cost: Number(totals.cost.toFixed(4)),
        timeSeconds: totals.timeSeconds
      },
      planVersion: 1,
      sessionId: session_id,
      createdAt: new Date().toISOString()
    };

    savePlan(plan.planId, plan);
    if (supabase.savePlanVersion) {
      await supabase.savePlanVersion(plan.planId, session_id, plan, 1);
    }

    return res.json(plan);
  } catch (error) {
    return next(error);
  }
});

const editSchema = z.object({
  session_id: z.string().uuid(),
  edits: z.array(z.object({
    subtaskId: z.number(),
    field: z.enum(['assignedModel', 'prompt', 'title']),
    value: z.string()
  }))
});

router.post('/:planId/edit', validate(editSchema), async (req, res, next) => {
  try {
    const { planId } = req.params;
    const { session_id, edits } = req.body;

    let plan = null;
    let previousVersion = 1;

    if (supabase.getLatestPlan) {
      const { data } = await supabase.getLatestPlan(planId);
      if (data && data.session_id === session_id) {
        plan = data.plan_json;
        previousVersion = Number(data.plan_version || 1);
      }
    }

    if (!plan) {
      const inMemory = getPlan(planId);
      if (!inMemory || inMemory.sessionId !== session_id) {
        return res.status(404).json({ error: 'Plan not found' });
      }
      plan = inMemory;
      previousVersion = Number(inMemory.planVersion || 1);
    }

    const availableModels = await getAvailableModels(session_id);
    const availableModelIds = new Set(availableModels.map((m) => m.id));

    for (const edit of edits) {
      const task = plan.subtasks.find((t) => t.id === edit.subtaskId);
      if (!task) continue;

      if (edit.field === 'assignedModel' && !availableModelIds.has(edit.value)) {
        return res.status(400).json({ error: `Invalid assignedModel: ${edit.value}` });
      }

      task[edit.field] = edit.value;
      if (edit.field === 'assignedModel' || edit.field === 'prompt') {
        const estimate = estimateTokensAndCost(task.prompt, task.assignedModel);
        task.estimatedTokens = estimate.tokens;
        task.estimatedCost = estimate.cost;
        task.estimatedTime = estimate.timeSeconds;
      }
    }

    const totals = plan.subtasks.reduce((acc, task) => {
      acc.tokens += task.estimatedTokens || 0;
      acc.cost += task.estimatedCost || 0;
      acc.timeSeconds += task.estimatedTime || 0;
      return acc;
    }, { tokens: 0, cost: 0, timeSeconds: 0 });

    plan.totalEstimate = {
      tokens: totals.tokens,
      cost: Number(totals.cost.toFixed(4)),
      timeSeconds: totals.timeSeconds
    };
    plan.planVersion = previousVersion + 1;
    plan.createdAt = new Date().toISOString();

    savePlan(planId, plan);
    if (supabase.savePlanVersion) {
      await supabase.savePlanVersion(planId, session_id, plan, plan.planVersion);
    }

    return res.json(plan);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
