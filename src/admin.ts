import { Redis } from 'ioredis';

type TokenLimit = {
  token: string;
  limit: number;
};

export async function setLimits(redis: Redis, tokens: TokenLimit[]) {
  const args = tokens.reduce(
    (res, { token, limit }) => [...res, token, limit],
    <(string | number)[]>[],
  );
  await redis.hset('_tollbooth:limit', ...args);
}

export async function removeLimits(redis: Redis, tokens: string[]) {
  await redis.hdel('_tollbooth:limit', ...tokens);
}

export async function getLimit(redis: Redis, token: string) {
  const res = (await redis.hget('_tollbooth:limit', token)) || '0';
  return parseInt(res);
}

export async function evict(redis: Redis) {
  const keys = await redis.keys('_tollbooth:*');
  if (!keys.length) {
    return;
  }
  await redis.del(...keys);
}
