import Redis from 'ioredis';
import { getTokenLimit, removeTokens, setTokensLimits, evict } from '../src/admin';

const redis = new Redis('redis://localhost:6379');

afterAll(() => redis.quit());

describe('admin tools', () => {
  afterEach(async () => {
    await evict(redis);
  });

  test('setTokensLimits creates all entries', async () => {
    await setTokensLimits(redis, [
      { token: 't1', limit: 11 },
      { token: 't2', limit: 0 },
      { token: 't3', limit: -2 },
    ]);

    await expect(redis.hget('_fact:limit', 't1')).resolves.toEqual('11');
    await expect(redis.hget('_fact:limit', 't2')).resolves.toEqual('0');
    await expect(redis.hget('_fact:limit', 't3')).resolves.toEqual('-2');
  });

  test('getTokenLimit returns limit', async () => {
    await setTokensLimits(redis, [{ token: 't1', limit: 11 }]);

    await expect(getTokenLimit(redis, 't1')).resolves.toEqual(11);
    await expect(getTokenLimit(redis, 't2')).resolves.toEqual(0);
  });

  test('removeTokens removes all entries', async () => {
    await setTokensLimits(redis, [
      { token: 'r1', limit: 10 },
      { token: 'r2', limit: 11 },
      { token: 'r3', limit: 12 },
    ]);

    await expect(redis.hkeys('_fact:limit')).resolves.toEqual(['r1', 'r2', 'r3']);

    await removeTokens(redis, ['r1', 'r2']);

    await expect(redis.hkeys('_fact:limit')).resolves.toEqual(['r3']);
  });

  test('evict removes only its own keys', async () => {
    await redis.set('foo', 'bar');

    await setTokensLimits(redis, [{ token: 'r1', limit: 10 }]);
    await redis.set('_fact:throttle:token', 5);

    await evict(redis);

    await expect(redis.keys('*')).resolves.toEqual(['foo']);
  });
});
