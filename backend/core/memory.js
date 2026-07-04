const supabase = require('../db/supabase');

const FACTS_CAP = 50;
const DECISIONS_CAP = 20;

/**
 * Read stored context for a session.
 * Returns { facts: string[], decisions: string[] }.
 * If no record exists yet, returns empty lists rather than throwing.
 */
async function readContext(sessionId) {
  const { data, error } = await supabase
    .from('session_context')
    .select('context')
    .eq('session_id', sessionId)
    .limit(1)
    .single();

  // "PGRST116" is Supabase's "no rows returned" code from .single()
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to read session context: ${error.message}`);
  }

  if (!data || !data.context) {
    return { facts: [], decisions: [] };
  }

  const ctx = data.context;
  return {
    facts: Array.isArray(ctx.facts) ? ctx.facts : [],
    decisions: Array.isArray(ctx.decisions) ? ctx.decisions : []
  };
}

/**
 * Write (merge) new facts and/or decisions into stored context.
 * Reads current context, appends new entries, truncates to caps, then persists.
 * @param {string} sessionId
 * @param {{ facts?: string[], decisions?: string[] }} patch
 */
async function writeContext(sessionId, patch) {
  const current = await readContext(sessionId);

  const newFacts = Array.isArray(patch?.facts) ? patch.facts : [];
  const newDecisions = Array.isArray(patch?.decisions) ? patch.decisions : [];

  const mergedFacts = [...current.facts, ...newFacts].slice(-FACTS_CAP);
  const mergedDecisions = [...current.decisions, ...newDecisions].slice(-DECISIONS_CAP);

  const merged = { facts: mergedFacts, decisions: mergedDecisions };

  const { error } = await supabase
    .from('session_context')
    .upsert(
      {
        session_id: sessionId,
        context: merged,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'session_id' }
    );

  if (error) {
    throw new Error(`Failed to write session context: ${error.message}`);
  }

  return merged;
}

module.exports = {
  readContext,
  writeContext
};
