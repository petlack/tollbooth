import { Redis } from 'ioredis';

type TokenLimit = {
  token: string;
  limit: number;
};

export async function setTokensLimits(redis: Redis, tokens: TokenLimit[]) {
  const args = tokens.reduce(
    (res, { token, limit }) => [...res, token, limit],
    <(string | number)[]>[],
  );
  await redis.hset('_fact:limit', ...args);
}

export async function removeTokens(redis: Redis, tokens: string[]) {
  await redis.hdel('_fact:limit', ...tokens);
}

export async function getTokenLimit(redis: Redis, token: string) {
  const res = (await redis.hget('_fact:limit', token)) || '0';
  return parseInt(res);
}

export async function evict(redis: Redis) {
  const keys = await redis.keys('_fact:*');
  if (!keys.length) {
    return;
  }
  await redis.del(...keys);
}
