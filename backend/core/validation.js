function isValidUuid(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function requireValidSessionId(sessionId) {
  if (!sessionId) {
    return 'Missing required field: session_id';
  }
  if (!isValidUuid(sessionId)) {
    return 'session_id must be a valid UUID';
  }
  return null;
}

module.exports = {
  isValidUuid,
  requireValidSessionId,
};
