import Redis from 'ioredis';
import { getTokenLimit, setTokensLimits, evict } from '../src/admin';

import Tollbooth from '../src/tollbooth';
import { TollboothCode } from '../src/types';

const redis = new Redis('redis://localhost:6379');

afterAll(() => redis.quit());

// @ts-ignore
const failingRedis: Redis = {
  eval() {
    throw new Error('Redis mock error');
  },
};

// @ts-ignore
function customResponseRedis(response: any): Redis {
  // @ts-ignore
  return {
    eval() {
      return response;
    },
  };
}

const protect = Tollbooth({
  redis,
  // debug: true,
  allowAnonymous: false,
  routes: [{ path: '/foo', method: 'get' }],
  throttleInterval: 1,
});

const protectedRequest = (token?: string) => ({
  path: '/foo',
  token,
  method: 'get',
});

const notFoundRequest = (token?: string) => ({
  path: '/404',
  token,
  method: 'get',
});

const UNAUTHORIZED = {
  code: TollboothCode.Unauthorized,
  message: 'Unauthorized',
  statusCode: 401,
};
const LIMIT_REACHED = {
  code: TollboothCode.LimitReached,
  message: 'LimitReached',
  statusCode: 429,
};
const TOO_MANY_REQUESTS = {
  code: TollboothCode.TooManyRequests,
  message: 'TooManyRequests',
  statusCode: 429,
};
const REDIS_ERROR = {
  code: TollboothCode.RedisError,
  message: 'RedisError',
  statusCode: 500,
};
const OK = {
  code: TollboothCode.Ok,
  message: 'Ok',
  statusCode: 200,
};

const systemKeys = ['_tollbooth:limit'];

describe('unauthorized access', () => {
  afterEach(async () => {
    await evict(redis);
  });

  test('unknown token rejects the request', async () => {
    await expect(protect(protectedRequest('UnknownToken'))).resolves.toEqual(UNAUTHORIZED);
  });
});

describe('anonymous access', () => {
  const protectAnonymous = Tollbooth({
    redis,
    allowAnonymous: true,
    routes: [{ path: '/foo', method: 'get' }],
  });

  beforeEach(async () => {
    await setTokensLimits(redis, [{ token: 'ClientToken', limit: 5 }]);
    await setTokensLimits(redis, [{ token: 'anonymous', limit: 1 }]);
  });

  afterEach(async () => {
    await evict(redis);
  });

  test('anonymous request does not fail', async () => {
    await expect(protectAnonymous(protectedRequest())).resolves.toEqual(OK);
  });

  test('anonymous request updates hits', async () => {
    await protectAnonymous(protectedRequest());

    const keys = await redis.keys('*');
    expect(keys.sort()).toEqual([...systemKeys, '_tollbooth:throttle:anonymous'].sort());
  });
});

describe('throttle', () => {
  beforeEach(async () => {
    await setTokensLimits(redis, [{ token: 'ClientToken', limit: 15 }]);
  });

  afterEach(async () => {
    await evict(redis);
  });

  test('blocks when too many requests', async () => {
    await Promise.all(
      Array.from({ length: 10 }, (i) => i).map(() => protect(protectedRequest('ClientToken'))),
    );

    await expect(protect(protectedRequest('ClientToken'))).resolves.toEqual(TOO_MANY_REQUESTS);

    const keys = await redis.keys('*');
    expect(keys.sort()).toEqual([...systemKeys, '_tollbooth:throttle:ClientToken'].sort());
  });

  test('unblocks after throttleInterval expired', async () => {
    await Promise.all(
      Array.from({ length: 10 }, (i) => i).map(() => protect(protectedRequest('ClientToken'))),
    );

    await expect(protect(protectedRequest('ClientToken'))).resolves.toEqual(TOO_MANY_REQUESTS);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    await expect(protect(protectedRequest('ClientToken'))).resolves.toEqual(OK);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const throttle = await redis.get('_tollbooth:throttle:ClientToken');
    expect(throttle).toBeNull();

    const keys = await redis.keys('*');
    expect(keys).toEqual(systemKeys);
  });

  test('does not block with throttle disabled', async () => {
    const noThrottleProtect = Tollbooth({
      redis,
      // debug: true,
      allowAnonymous: false,
      routes: [{ path: '/foo', method: 'get' }],
      throttleEnabled: false,
    });

    await Promise.all(
      Array.from({ length: 10 }, (i) => i).map(() => protect(protectedRequest('ClientToken'))),
    );

    await expect(protect(protectedRequest('ClientToken'))).resolves.toEqual(TOO_MANY_REQUESTS);
    await expect(noThrottleProtect(protectedRequest('ClientToken'))).resolves.toEqual(OK);
  });
});

describe('exceptions', () => {
  const noConnectionRedis = new Redis('redis://localhost:9999', {
    commandTimeout: 100,
    connectTimeout: 100,
    disconnectTimeout: 100,
  });

  afterAll(() => noConnectionRedis.disconnect());

  test('when connection to redis times out, fails', async () => {
    const noConnectionProtect = Tollbooth({
      redis: noConnectionRedis,
      routes: [{ path: '/foo', method: 'get' }],
      failOnExceptions: true,
    });

    await expect(noConnectionProtect(protectedRequest('ClientToken'))).resolves.toEqual({
      ...REDIS_ERROR,
      info: 'Command timed out',
    });
  });

  test('when redis returns null response, fails', async () => {
    const nullResponseProtect = Tollbooth({
      redis: customResponseRedis(null),
      routes: [{ path: '/foo', method: 'get' }],
      failOnExceptions: true,
    });

    await expect(nullResponseProtect(protectedRequest('ClientToken'))).resolves.toEqual(
      REDIS_ERROR,
    );
  });

  test('when redis returns unkown response, fails', async () => {
    const unknownResponseProtect = Tollbooth({
      redis: customResponseRedis(-100),
      routes: [{ path: '/foo', method: 'get' }],
      failOnExceptions: true,
    });

    await expect(unknownResponseProtect(protectedRequest('ClientToken'))).resolves.toEqual(
      REDIS_ERROR,
    );
  });

  test('when failOnExceptions is true, fails on error', async () => {
    const failProtect = Tollbooth({
      redis: failingRedis,
      routes: [{ path: '/foo', method: 'get' }],
      failOnExceptions: true,
    });

    await expect(failProtect(protectedRequest('ClientToken'))).resolves.toEqual({
      ...REDIS_ERROR,
      info: 'Redis mock error',
    });
  });

  test('when failOnExceptions is false, does not fail on error', async () => {
    const failProtect = Tollbooth({
      redis: failingRedis,
      routes: [{ path: '/foo', method: 'get' }],
      failOnExceptions: false,
    });

    await expect(failProtect(protectedRequest('ClientToken'))).resolves.toEqual(OK);
  });
});

describe('update hits', () => {
  beforeEach(async () => {
    await setTokensLimits(redis, [{ token: 'ClientToken', limit: 5 }]);
  });

  afterEach(async () => {
    await evict(redis);
  });

  test('anonymous request on protected path does not update hits', async () => {
    await expect(protect(protectedRequest())).resolves.toEqual(UNAUTHORIZED);

    const keys = await redis.keys('*');
    expect(keys).toEqual(systemKeys);
  });

  test('anonymous request on unprotected path does not update hits', async () => {
    await expect(protect(notFoundRequest())).resolves.toEqual(OK);

    const keys = await redis.keys('*');
    expect(keys).toEqual(systemKeys);
  });

  test('protected path with different hostname updates hits', async () => {
    await protect({
      path: '/foo',
      token: 'ClientToken',
      method: 'get',
    });

    const keys = await redis.keys('*');
    expect(keys.sort()).toEqual([...systemKeys, '_tollbooth:throttle:ClientToken'].sort());
  });

  test('protected path updates hits', async () => {
    await protect(protectedRequest('ClientToken'));

    const keys = await redis.keys('*');
    expect(keys.sort()).toEqual([...systemKeys, '_tollbooth:throttle:ClientToken'].sort());
  });

  test('unprotected path does not update hits', async () => {
    await protect(notFoundRequest('ClientToken'));

    const keys = await redis.keys('*');
    expect(keys).toEqual(systemKeys);
  });
});

describe('protect all paths', () => {
  afterEach(async () => {
    await evict(redis);
  });

  const protectAll = Tollbooth({
    redis,
    routes: [{ path: '*', method: 'get' }],
  });

  test('request to all routes is protected', async () => {
    await setTokensLimits(redis, [{ token: 'ClientToken', limit: 0 }]);
    await expect(protectAll(notFoundRequest('ClientToken'))).resolves.toEqual(LIMIT_REACHED);
  });
});

describe('blocking', () => {
  beforeEach(async () => {
    await setTokensLimits(redis, [{ token: 'ClientToken', limit: 5 }]);
  });

  afterEach(async () => {
    await evict(redis);
  });

  test('anonymous request fails', async () => {
    await expect(protect(protectedRequest())).resolves.toEqual(UNAUTHORIZED);
  });

  test('protected path blocked when limit == 0', async () => {
    await setTokensLimits(redis, [{ token: 'ClientToken', limit: 0 }]);
    await expect(protect(protectedRequest('ClientToken'))).resolves.toEqual(LIMIT_REACHED);
  });

  test('protected path not blocked when limit > 0', async () => {
    await setTokensLimits(redis, [{ token: 'ClientToken', limit: 5 }]);
    await expect(protect(protectedRequest('ClientToken'))).resolves.toEqual(OK);
  });

  test('protected path updates hits when limit > 0', async () => {
    await setTokensLimits(redis, [{ token: 'ClientToken', limit: 5 }]);
    await protect(protectedRequest('ClientToken'));
    const hits = await getTokenLimit(redis, 'ClientToken');
    expect(hits).toBe(4);
  });

  test('protected path does not update hits when limit == 0', async () => {
    await setTokensLimits(redis, [{ token: 'ClientToken', limit: 0 }]);
    await expect(protect(protectedRequest('ClientToken'))).resolves.toEqual(LIMIT_REACHED);
    const hits = await getTokenLimit(redis, 'ClientToken');
    expect(hits).toBe(0);
  });

  test('protected path does not update hits when limit < 0', async () => {
    await setTokensLimits(redis, [{ token: 'ClientToken', limit: -1 }]);
    await expect(protect(protectedRequest('ClientToken'))).resolves.toEqual(LIMIT_REACHED);
    const hits = await getTokenLimit(redis, 'ClientToken');
    expect(hits).toBe(-1);
  });

  test('unprotected path not blocked when limit == 0', async () => {
    await setTokensLimits(redis, [{ token: 'ClientToken', limit: 0 }]);
    await expect(protect(notFoundRequest('ClientToken'))).resolves.toEqual(OK);
  });
});

describe('logging', () => {
  const consoleLogMock = jest.spyOn(console, 'log').mockImplementation();

  afterEach(() => {
    consoleLogMock.mockRestore();
  });

  test('logs to console', async () => {
    const protect = Tollbooth({
      redis,
      routes: [{ path: '/foo', method: 'get' }],
      debug: true,
    });

    await setTokensLimits(redis, [{ token: 'ClientToken', limit: 5 }]);

    await expect(protect(protectedRequest('ClientToken'))).resolves.toEqual(OK);

    expect(consoleLogMock).toHaveBeenCalledWith('= Tollbooth debug =');
  });
});
