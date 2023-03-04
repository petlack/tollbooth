import Redis from 'ioredis';
import { setLimits, evict } from '../src/admin';

import Tollbooth from '../src/lambda';

import {
  invokeLambda,
  expectStatus,
  expectData,
  expectNoErrors,
  okHandler,
  failHandler,
  expectOneCall,
  AwsEventArgs,
  expectOneErrorMessage,
  expectBody,
} from './helpers';

// const redis = new Redis({
//   data: {},
// });

const redis = new Redis('redis://localhost:6379');

afterAll(() => redis.quit());

const protect = Tollbooth({
  redis,
  routes: [{ path: '/foo', method: 'get' }],
  allowAnonymous: false,
});

const protectedRequest = (client?: string, tokenHeaderName = 'x-api-key'): AwsEventArgs => ({
  path: '/foo',
  method: 'GET',
  host: 'example.com',
  ...(client ? { headers: { [tokenHeaderName]: client } } : {}),
});

const systemKeys = ['_tollbooth:limit'];

describe('token', () => {
  beforeEach(async () => {
    await setLimits(redis, [{ token: 'ClientToken', limit: 5 }]);
  });

  afterEach(async () => {
    await evict(redis);
  });

  test('uses x-api-key by default', async () => {
    const protect = Tollbooth({
      redis,
      routes: [{ path: '/foo', method: 'get' }],
    });

    const handler = okHandler({ status: 'ok' });

    const stub = await invokeLambda(protect(handler), protectedRequest('ClientToken'));

    expectStatus(stub, 200);
    expectData(stub, { status: 'ok' });
    expectNoErrors(stub);
  });

  test('uses custom header name', async () => {
    const protect = Tollbooth({
      redis,
      routes: [{ path: '/foo', method: 'get' }],
      tokenHeaderName: 'x-custom',
    });

    const handler = okHandler({ status: 'ok' });

    const stub = await invokeLambda(protect(handler), protectedRequest('ClientToken', 'x-custom'));

    expectStatus(stub, 200);
    expectData(stub, { status: 'ok' });
    expectNoErrors(stub);
  });
});

describe('error handler', () => {
  test('uses custom error handler', async () => {
    const protect = Tollbooth({
      redis,
      routes: [{ path: '/foo', method: 'get' }],
      errorHandler: (callback, error) => {
        callback(null, {
          statusCode: error.statusCode,
          body: JSON.stringify({ error: error.message }),
        });
      },
    });

    const handler = okHandler({ status: 'ok' });

    const stub = await invokeLambda(protect(handler), protectedRequest('ClientToken'));

    expectStatus(stub, 401);
    expectBody(stub, { error: 'Unauthorized' });
  });
});

describe('responses', () => {
  beforeEach(async () => {
    await setLimits(redis, [{ token: 'ClientToken', limit: 5 }]);
  });

  afterEach(async () => {
    await evict(redis);
  });

  test('200 correct response', async () => {
    const handler = okHandler({ status: 'ok' });

    const stub = await invokeLambda(protect(handler), protectedRequest('ClientToken'));

    expectStatus(stub, 200);
    expectData(stub, { status: 'ok' });
    expectNoErrors(stub);
  });

  test('200 correct response with no hostname', async () => {
    const handler = okHandler({ status: 'ok' });

    const stub = await invokeLambda(protect(handler), {
      path: '/foo',
      method: 'GET',
      headers: {
        'x-api-key': 'ClientToken',
      },
    });

    expectStatus(stub, 200);
    expectData(stub, { status: 'ok' });
    expectNoErrors(stub);
  });

  test('200 updates hits', async () => {
    const handler = okHandler({ status: 'ok' });

    await invokeLambda(protect(handler), protectedRequest('ClientToken'));

    const keys = await redis.keys('*');
    expect(keys.sort()).toEqual([...systemKeys, '_tollbooth:throttle:ClientToken'].sort());
  });

  test('401 unauthorized when missing token', async () => {
    const handler = okHandler({ status: 'ok' });
    const expected = [
      null,
      {
        statusCode: 401,
        body: {
          errors: [{ message: 'Unauthorized' }],
          data: null,
        },
      },
    ];

    const stub = await invokeLambda(protect(handler), protectedRequest());

    expectOneCall(stub, expected);
  });

  test('404 does not update hits', async () => {
    const handler = failHandler({ statusCode: 404, message: 'Not Found' });

    await invokeLambda(protect(handler), {
      path: '/404',
      method: 'GET',
      host: 'example.com',
      headers: {
        'x-api-key': 'ClientToken',
      },
    });

    const keys = await redis.keys('*');
    expect(keys).toEqual(systemKeys);
  });

  test('GET 500 request when fails with unknown error', async () => {
    const handler = failHandler({ msg: 'foo' });

    const stub = await invokeLambda(protect(handler), protectedRequest('ClientToken'));

    expectStatus(stub, 500);
    expectOneErrorMessage(stub, 'unknown error with keys [msg]');
  });

  test('GET 500 request when fails with exception', async () => {
    const handler = failHandler(new Error('Exception Error'));

    const stub = await invokeLambda(protect(handler), protectedRequest('ClientToken'));

    expectStatus(stub, 500);
    expectOneErrorMessage(stub, 'Exception Error');
  });

  test('GET 403 request when fails with custom status code and unknown error', async () => {
    const handler = failHandler({ statusCode: 403 });

    const stub = await invokeLambda(protect(handler), protectedRequest('ClientToken'));

    expectStatus(stub, 403);
    expectOneErrorMessage(stub, '403');
  });

  test('GET 400 request when fails with custom error', async () => {
    const handler = failHandler({ statusCode: 400, message: 'Bad Request' });

    const stub = await invokeLambda(protect(handler), protectedRequest('ClientToken'));

    expectStatus(stub, 400);
    expectOneErrorMessage(stub, 'Bad Request');
  });

  test('GET 429 too many requests when limit == hits', async () => {
    const handler = okHandler({ status: 'ok' });

    await redis.hset('_tollbooth:limit', 'ClientToken', 0);

    const stub = await invokeLambda(protect(handler), protectedRequest('ClientToken'));

    expectStatus(stub, 429);
    expectOneErrorMessage(stub, 'LimitReached');
  });
});
