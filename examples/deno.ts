import { default as Tollbooth, setTokensLimits, TollboothCode } from 'npm:tollbooth@0.2';
import { RedisFromSendCommand } from 'npm:tollbooth@0.2/deno.js';
import { sendCommand } from 'https://deno.land/x/r2d2/mod.ts';

const redisConn = await Deno.connect({ host: 'localhost', port: 6379 });

const redis = RedisFromSendCommand(redisConn, sendCommand);

const protect = Tollbooth.default({
  redis,
  routes: [{ path: '/foo', method: 'get' }],
});

await setTokensLimits(redis, [{ token: 'my_token', limit: 5 }]);
const success = await protect({
  path: '/foo',
  method: 'get',
  token: 'my_token',
});

console.assert(success.code === TollboothCode.Ok);
console.log('Result', success);
