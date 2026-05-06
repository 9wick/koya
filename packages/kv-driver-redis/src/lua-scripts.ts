/**
 * Atomic increment with TTL on first increment only (rate-limiter-flexible pattern).
 * SET NX EX initializes key to 0 with TTL atomically if key doesn't exist.
 * INCRBY then increments. TTL is not extended on subsequent increments.
 */
export const INCR_WITH_TTL_LUA = `
  if ARGV[2] ~= '' then
    redis.call('SET', KEYS[1], 0, 'EX', ARGV[2], 'NX')
  end
  return redis.call('INCRBY', KEYS[1], ARGV[1])
`;
