# Tollbooth

[![Run tests](https://github.com/petlack/tollbooth/actions/workflows/run-tests.yml/badge.svg)](https://github.com/petlack/tollbooth/actions/workflows/run-tests.yml)
[![CodeQL](https://github.com/petlack/tollbooth/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/petlack/tollbooth/actions/workflows/github-code-scanning/codeql)
[![npm version](https://img.shields.io/npm/v/tollbooth.svg)](https://www.npmjs.com/package/tollbooth)
![coverage](https://raw.githubusercontent.com/petlack/tollbooth/gh-pages/badge-coverage.svg)

Tollbooth is a small utility (10kB raw JS) for Node.js, Express & AWS Lambda that throttles and limits number of requests per client using Redis.

- [Install](#install)
- [How it works](#how-it-works)
- [Usage with Express](#usage-with-express)
- [Usage with AWS Lambda](#usage-with-aws-lambda)
- [Manual usage](#manual-usage)
- [Configuration options](#configuration-options)
- [Admin helpers](#admin-helpers)
- [Examples](#examples)
- [Benchmarks](#benchmarks)
- [Development](#development)

## Install

```
npm add tollbooth
```

## How it works

1. Checks how many requests does given token still have left.
2. If the token was not given limit (i.e. [setClientsLimits](#admin-helpers) was not called), rejects the request with **Unauthorized**.
3. If the token does not have enough requests (i.e. limit <= 0), rejects the request with **LimitReached**.
4. Checks how many requests did the token make recently.
5. If the token made more than X requests in the last N seconds (configurable), rejects the request with **TooManyRequests**.
6. Otherwise, accepts the request with **Ok**.

## Usage with Express

```typescript
import express from 'express';
import Redis from 'ioredis';
import Tollbooth from 'tollbooth/express';

const redis = new Redis('redis://localhost:6379');

const app = express();

app.use(
  Tollbooth({
    redis,
    routes: [{ path: '/foo', method: 'get' }],
  }),
);

// setup the express app & start the server
```

By default, the token will be read from **x-api-key** header. See [Configuration Options](#configuration-options) for customisation.

To manage tokens and limits, you can use [Admin helpers](#admin-helpers).

```typescript
import { setTokensLimits, getTokenLimit, removeTokens } from 'tollbooth';

// set tokens limits
// e.g. post request to create new account, cron job refreshing limits monthly
await setTokensLimits(redis, [{ token: 'my_token', limit: 1_000 }]);
// token with no limit
await setTokensLimits(redis, [{ token: 'my_token', limit: -1 }]);

// get token limit
// e.g. in user dashboard
const limit: number = await getTokenLimit(redis, 'my_token');

// remove tokens
// e.g. on account termination
await removeTokens(redis, ['my_token']);
```

## Usage with AWS Lambda

```typescript
import { Context, APIGatewayProxyCallback, APIGatewayEvent } from 'aws-lambda';
import Redis from 'ioredis';
import Tollbooth from 'tollbooth/lambda';

const redis = new Redis('redis://localhost:6379');

const protect = Tollbooth({
  redis,
  routes: [{ path: '*', method: 'get' }],
});

function handle(_event: APIGatewayEvent, _context: Context, callback: APIGatewayProxyCallback) {
  callback(null, {
    statusCode: 200,
    body: JSON.stringify({ status: 'ok' }),
  });
}

export const handler = protect(handle);
```

By default, the token will be read from **x-api-key** header. See [Configuration Options](#configuration-options) for customisation.

## Manual usage

```typescript
import Tollbooth, { TollboothCode, setTokensLimits } from 'tollbooth';
import Redis from 'ioredis';

const redis = new Redis('redis://localhost:6379');
const protect = Tollbooth({
  redis,
  routes: [{ path: '/foo', method: 'get' }],
});

// ... application logic
await setTokensLimits(redis, [{ token: 'my_token', limit: 5 }]);

const success = await protect({
  path: '/foo',
  method: 'get',
  token: 'my_token',
});

console.assert(success.code === TollboothCode.Ok);
console.log('Result', success);
// ... application logic
```

### Return value

```typescript
{
  // HTTP status code
  statusCode: number;
  // Internal code
  code: TollboothCode.TooManyRequests |
    TollboothCode.Unauthorized |
    TollboothCode.LimitReached |
    TollboothCode.Ok |
    TollboothCode.RedisError;
  // Human readable code
  message: 'TooManyRequests' | 'Unauthorized' | 'LimitReached' | 'Ok' | 'RedisError';
}
```

## Configuration options

- `redis`: Redis instance, e.g. `ioredis`
- `routes`: List of protected routes
  - `path`: Relative path, e.g. `/foo`, or `*` to protect all paths with given method.
  - `method`: One of `get`, `head`, `post`, `put`, `patch`, `delete`, `options`
- `tokenHeaderName`: _(Only for Express and AWS Lambda)_ Name of the header containing token. Default `x-api-key`
- `errorHandler`: _(Only for Express and AWS Lambda)_ Custom error handler function with signature `(res: express.Response | APIGatewayProxyCallback, error: tollbooth.TollboothError) => void`
- `allowAnonymous`: _(Optional)_ If set to `true`, allows access without token. Default: `false`
- `debug`: _(Optional)_ If set to `true`, will enable console logging. Default: `false`
- `failOnExceptions`: _(Optional)_ If set to `false`, will not propagate exceptions (e.g. redis connection error), therefore allowing access. Default: `true`
- `throttleEnabled`: _(Optional)_ If set to `false`, turns off throttling. Default: `true`
- `throttleInterval`: _(Optional)_ Duration of the throttle interval in seconds. For example, when `throttleInterval=2` and `throttleLimit=10`, it will allow max 10 requests per 2 seconds, or fail with 429 response. Default: `1`
- `throttleLimit`: _(Optional)_ Maximum number of requests executed during the throttle interval. Default: `10`.

## Admin helpers

```typescript
import Redis from 'ioredis';
import { setTokensLimits, removeTokens, getTokenLimit } from 'tollbooth';

const redis = Redis('redis://localhost:6379');

// ... application logic

// set token1 with maximum of 1_000 requests
// set token2 with maximum of 1 request
await setTokensLimits(redis, [
  { token: 'token1', limit: 1_000 },
  { token: 'token2', limit: 1 },
);

const currentLimit = await getTokenLimit(redis, 'token1');
console.log({ currentLimit });
// { currentLimit: 1000 }

// removes token1
await removeTokens(redis, ['token1']);

const newLimit = await getTokenLimit(redis, 'token1');
console.log({ newLimit });
// { newLimit: 0 }


// deletes all keys saved in redis
await evict(redis);

// ... application logic
```

## Examples

See [examples](examples/) folder.

- [Express server](examples/express-server.ts)
- [AWS Lambda handler](examples/aws-lambda-handler.ts)
- [HTTP server](examples/http-server.ts)
- [Manual usage](examples/manual.ts)

## Benchmarks

Start redis on `localhost:6379` and run

```bash
npm run benchmark
```

See [benchmarks](benchmarks/) folder. Currently comparing with executing single redis call.
Results on EC2 t4g.small instance with redis running locally.

```
incrByScalar x 13,199 ops/sec ±2.09% (83 runs sampled)
protect x 7,582 ops/sec ±1.48% (83 runs sampled)
incrByScalar x 62,546 calls took 5903 ms, made 62,547 redis calls
protect x 36,493 calls took 5963 ms, made 145,979 redis calls
total redis calls 208,526
```

## Development

### Build

```bash
npm run build
```

### Run tests

Start redis on `localhost:6379` and run

```bash
npm test
```
