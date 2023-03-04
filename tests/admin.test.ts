import Redis from 'ioredis';
import { getLimit, removeLimits, setLimits, evict } from '../src/admin';

const redis = new Redis('redis://localhost:6379');

afterAll(() => redis.quit());

describe('admin tools', () => {
  afterEach(async () => {
    await evict(redis);
  });

  test('setLimits creates all entries', async () => {
    await setLimits(redis, [
      { token: 't1', limit: 11 },
      { token: 't2', limit: 0 },
      { token: 't3', limit: -2 },
    ]);

    await expect(redis.hget('_tollbooth:limit', 't1')).resolves.toEqual('11');
    await expect(redis.hget('_tollbooth:limit', 't2')).resolves.toEqual('0');
    await expect(redis.hget('_tollbooth:limit', 't3')).resolves.toEqual('-2');
  });

  test('getLimit returns limit', async () => {
    await setLimits(redis, [{ token: 't1', limit: 11 }]);

    await expect(getLimit(redis, 't1')).resolves.toEqual(11);
    await expect(getLimit(redis, 't2')).resolves.toEqual(0);
  });

  test('removeLimits removes all entries', async () => {
    await setLimits(redis, [
      { token: 'r1', limit: 10 },
      { token: 'r2', limit: 11 },
      { token: 'r3', limit: 12 },
    ]);

    await expect(redis.hkeys('_tollbooth:limit')).resolves.toEqual(['r1', 'r2', 'r3']);

    await removeLimits(redis, ['r1', 'r2']);

    await expect(redis.hkeys('_tollbooth:limit')).resolves.toEqual(['r3']);
  });

  test('evict removes only its own keys', async () => {
    await redis.set('foo', 'bar');

    await setLimits(redis, [{ token: 'r1', limit: 10 }]);
    await redis.set('_tollbooth:throttle:token', 5);

    await evict(redis);

    await expect(redis.keys('*')).resolves.toEqual(['foo']);

    await redis.del('foo');
  });
});
