// Run as a one-time seed script: node db/seed_models.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const supabase = require('./supabase');

const seedData = [
  {
    model_id: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    display_name: 'Claude 3.5 Sonnet',
    strengths: 'research, writing, reasoning, coding',
    context_window: 200000,
    cost_per_1k_input: 0.003,
    cost_per_1k_output: 0.015,
    supports_streaming: true,
    is_active: true
  },
  {
    model_id: 'claude-3-haiku-20240307',
    provider: 'anthropic',
    display_name: 'Claude 3 Haiku',
    strengths: 'fast, general, low-cost',
    context_window: 200000,
    cost_per_1k_input: 0.00025,
    cost_per_1k_output: 0.00125,
    supports_streaming: true,
    is_active: true
  },
  {
    model_id: 'gpt-4o',
    provider: 'openai',
    display_name: 'GPT-4o',
    strengths: 'coding, logic, math, multimodal',
    context_window: 128000,
    cost_per_1k_input: 0.005,
    cost_per_1k_output: 0.015,
    supports_streaming: true,
    is_active: true
  },
  {
    model_id: 'gpt-4o-mini',
    provider: 'openai',
    display_name: 'GPT-4o Mini',
    strengths: 'fast, general, low-cost',
    context_window: 128000,
    cost_per_1k_input: 0.00015,
    cost_per_1k_output: 0.0006,
    supports_streaming: true,
    is_active: true
  },
  {
    model_id: 'gemini-1.5-pro',
    provider: 'google_gemini',
    display_name: 'Gemini 1.5 Pro',
    strengths: 'long-context, research, multimodal',
    context_window: 2000000,
    cost_per_1k_input: 0.0035,
    cost_per_1k_output: 0.0105,
    supports_streaming: true,
    is_active: true
  },
  {
    model_id: 'gemini-1.5-flash',
    provider: 'google_gemini',
    display_name: 'Gemini 1.5 Flash',
    strengths: 'fast, low-cost, general',
    context_window: 1000000,
    cost_per_1k_input: 0.000075,
    cost_per_1k_output: 0.0003,
    supports_streaming: true,
    is_active: true
  }
];

async function seed() {
  console.log("Seeding model_registry...");
  const { data, error } = await supabase
    .from('model_registry')
    .upsert(seedData, { onConflict: 'model_id' });

  if (error) {
    console.error("Error seeding models:", error);
    process.exit(1);
  } else {
    console.log(`Seeded ${seedData.length} models with no errors.`);
    process.exit(0);
  }
}

seed();
