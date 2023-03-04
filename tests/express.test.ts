import request from 'supertest';

import Redis from 'ioredis';
import express from 'express';

import Tollbooth from '../src/express';
import { setLimits, evict } from '../src/admin';

const redis = new Redis('redis://localhost:6379');

afterAll(() => redis.quit());

const systemKeys = ['_tollbooth:limit'];

function createApp({ tokenHeaderName }: { tokenHeaderName?: string } = {}) {
  const app = express();
  app.use(express.json());
  app.use(
    Tollbooth({
      allowAnonymous: false,
      redis,
      routes: [{ method: 'get', path: '/foo' }],
      tokenHeaderName,
    }),
  );

  app.get('/foo', (_req, res) => {
    res.send({ data: { status: 'ok' }, errors: null });
  });
  return app;
}

describe('token', () => {
  beforeEach(async () => {
    await setLimits(redis, [{ limit: 5, token: 'ClientToken' }]);
  });

  afterEach(async () => {
    await evict(redis);
  });

  test('uses x-api-key by default', async () => {
    const app = createApp();
    const expected = { data: { status: 'ok' }, errors: null };

    await request(app).get('/foo').set('x-api-key', 'ClientToken').expect(200, expected);
  });

  test('uses custom header name', async () => {
    const app = createApp({ tokenHeaderName: 'x-custom' });
    const expected = { data: { status: 'ok' }, errors: null };

    await request(app).get('/foo').set('x-custom', 'ClientToken').expect(200, expected);
  });
});

describe('error handler', () => {
  test('uses custom error handler', async () => {
    const app = express();
    app.use(express.json());
    app.use(
      Tollbooth({
        redis,
        routes: [{ method: 'get', path: '/foo' }],
        errorHandler: (res, error) => {
          res.status(error.statusCode).json({ error: error.message });
        },
      }),
    );

    const expected = { error: 'Unauthorized' };

    await request(app).get('/foo').expect(401, expected);
  });
});

describe('responses', () => {
  const app = createApp();

  beforeEach(async () => {
    await setLimits(redis, [{ limit: 5, token: 'ClientToken' }]);
  });

  afterEach(async () => {
    await evict(redis);
  });

  test('GET 200 passes data', async () => {
    const expected = { data: { status: 'ok' }, errors: null };

    await request(app).get('/foo').set('x-api-key', 'ClientToken').expect(200, expected);
  });

  test('GET 200 updates keys', async () => {
    const expected = { data: { status: 'ok' }, errors: null };

    await request(app).get('/foo').set('x-api-key', 'ClientToken').expect(200, expected);

    const keys = await redis.keys('*');
    expect(keys.sort()).toEqual([...systemKeys, '_tollbooth:throttle:ClientToken'].sort());
  });

  test('GET 404 does not update keys', async () => {
    await request(app).get('/404').set('x-api-key', 'ClientToken').expect(404);

    const keys = await redis.keys('*');
    expect(keys).toEqual(systemKeys);
  });

  test('GET 401 unauthorized', async () => {
    const expected = { data: null, errors: [{ message: 'Unauthorized' }] };

    await request(app).get('/foo').expect(401, expected);
  });

  test('GET 429 too many requests when limit == hits', async () => {
    const expected = { data: null, errors: [{ message: 'LimitReached' }] };

    await redis.hset('_tollbooth:limit', 'ClientToken', 0);

    await request(app).get('/foo').set('x-api-key', 'ClientToken').expect(429, expected);
  });
});
