/**
 * Migration: Update model_registry to current 2025/2026 models.
 * - Marks deprecated models as inactive (is_active = false)
 * - Inserts new current models (upsert on model_id)
 *
 * Run:  node migrate_models_2026.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const DEPRECATED_MODEL_IDS = [
  'gpt-4-turbo',
  'claude-3-haiku-20240307',
  'claude-3-opus-20240229',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
];

const CURRENT_MODELS = [
  {
    model_id: 'gpt-4o',
    provider: 'openai',
    display_name: 'GPT-4o',
    strengths: ['reasoning', 'coding', 'analysis', 'multimodal'],
    context_window: 128000,
    cost_per_1k_input: 0.005,
    cost_per_1k_output: 0.015,
    avg_latency_ms: 800,
    supports_streaming: true,
    supports_json_mode: true,
    is_active: true,
  },
  {
    model_id: 'gpt-4o-mini',
    provider: 'openai',
    display_name: 'GPT-4o Mini',
    strengths: ['fast', 'coding', 'general'],
    context_window: 128000,
    cost_per_1k_input: 0.00015,
    cost_per_1k_output: 0.0006,
    avg_latency_ms: 400,
    supports_streaming: true,
    supports_json_mode: true,
    is_active: true,
  },
  {
    model_id: 'gpt-4.1',
    provider: 'openai',
    display_name: 'GPT-4.1',
    strengths: ['reasoning', 'analysis', 'coding'],
    context_window: 128000,
    cost_per_1k_input: 0.01,
    cost_per_1k_output: 0.03,
    avg_latency_ms: 1000,
    supports_streaming: true,
    supports_json_mode: true,
    is_active: true,
  },
  {
    model_id: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    display_name: 'Claude 4 Sonnet',
    strengths: ['coding', 'analysis', 'writing', 'reasoning'],
    context_window: 200000,
    cost_per_1k_input: 0.003,
    cost_per_1k_output: 0.015,
    avg_latency_ms: 600,
    supports_streaming: true,
    supports_json_mode: true,
    is_active: true,
  },
  {
    model_id: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
    display_name: 'Claude 3.5 Haiku',
    strengths: ['fast', 'general', 'summarization'],
    context_window: 200000,
    cost_per_1k_input: 0.0008,
    cost_per_1k_output: 0.004,
    avg_latency_ms: 300,
    supports_streaming: true,
    supports_json_mode: true,
    is_active: true,
  },
  {
    model_id: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    display_name: 'Claude 3.5 Sonnet',
    strengths: ['coding', 'analysis', 'writing', 'reasoning'],
    context_window: 200000,
    cost_per_1k_input: 0.003,
    cost_per_1k_output: 0.015,
    avg_latency_ms: 600,
    supports_streaming: true,
    supports_json_mode: true,
    is_active: true,
  },
  {
    model_id: 'gemini-2.5-pro',
    provider: 'google_gemini',
    display_name: 'Gemini 2.5 Pro',
    strengths: ['reasoning', 'multimodal', 'long-context', 'coding'],
    context_window: 1048576,
    cost_per_1k_input: 0.00125,
    cost_per_1k_output: 0.01,
    avg_latency_ms: 800,
    supports_streaming: true,
    supports_json_mode: true,
    is_active: true,
  },
  {
    model_id: 'gemini-2.5-flash',
    provider: 'google_gemini',
    display_name: 'Gemini 2.5 Flash',
    strengths: ['fast', 'reasoning', 'multimodal', 'coding'],
    context_window: 1048576,
    cost_per_1k_input: 0.000075,
    cost_per_1k_output: 0.0003,
    avg_latency_ms: 150,
    supports_streaming: true,
    supports_json_mode: true,
    is_active: true,
  },
  {
    model_id: 'gemini-2.0-flash',
    provider: 'google_gemini',
    display_name: 'Gemini 2.0 Flash',
    strengths: ['fast', 'general', 'multimodal'],
    context_window: 1048576,
    cost_per_1k_input: 0.0001,
    cost_per_1k_output: 0.0004,
    avg_latency_ms: 200,
    supports_streaming: true,
    supports_json_mode: true,
    is_active: true,
  },
];

async function migrate() {
  console.log('🔄 Marking deprecated models as inactive...');
  const { error: deactivateError } = await supabase
    .from('model_registry')
    .update({ is_active: false })
    .in('model_id', DEPRECATED_MODEL_IDS);

  if (deactivateError) {
    console.error('❌ Failed to deactivate deprecated models:', deactivateError.message);
  } else {
    console.log(`✅ Marked ${DEPRECATED_MODEL_IDS.length} deprecated models as inactive`);
  }

  console.log('🔄 Upserting current models...');
  for (const model of CURRENT_MODELS) {
    const { error } = await supabase
      .from('model_registry')
      .upsert(model, { onConflict: 'model_id' });

    if (error) {
      console.error(`❌ Failed to upsert ${model.model_id}:`, error.message);
    } else {
      console.log(`  ✅ ${model.display_name} (${model.model_id})`);
    }
  }

  console.log('\n🎉 Model registry migration complete!');
}

migrate();
