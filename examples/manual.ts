import Tollbooth, { TollboothCode, setLimits, removeLimits, evict } from '../src';
import Redis from 'ioredis';

const redis = new Redis('redis://localhost:6379');
const protect = Tollbooth({
  redis,
  routes: [{ path: '/foo', method: 'get' }],
});

async function run() {
  await setLimits(redis, [{ token: 'my_token', limit: 5 }]);
  const success = await protect({
    path: '/foo',
    method: 'get',
    token: 'my_token',
  });

  console.assert(success.code === TollboothCode.Ok);
  console.log('Result', success);

  await setLimits(redis, [{ token: 'my_token', limit: 0 }]);
  const tooManyRequests = await protect({
    path: '/foo',
    method: 'get',
    token: 'my_token',
  });

  console.assert(tooManyRequests.code === TollboothCode.LimitReached);
  console.log('Result', tooManyRequests);

  await removeLimits(redis, ['my_token']);
  const unauthorized = await protect({
    path: '/foo',
    method: 'get',
  });

  console.assert(unauthorized.code === TollboothCode.Unauthorized);
  console.log('Result', unauthorized);

  await setLimits(redis, [{ token: 'my_token', limit: -1 }]);
  const unlimited = await protect({
    path: '/foo',
    method: 'get',
    token: 'my_token',
  });

  console.assert(unlimited.code === TollboothCode.Ok);
  console.log('Result', unlimited);

  await evict(redis);
}

run()
  .then(() => {
    process.exit(1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
