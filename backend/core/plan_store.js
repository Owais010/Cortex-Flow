const planStore = new Map();

function savePlan(planId, payload) {
  if (!planId || typeof planId !== 'string') {
    throw new Error('planId must be a non-empty string');
  }
  planStore.set(planId, payload);
}

function getPlan(planId) {
  if (!planId || typeof planId !== 'string') {
    throw new Error('planId must be a non-empty string');
  }
  return planStore.get(planId) || null;
}

module.exports = {
  savePlan,
  getPlan
};
