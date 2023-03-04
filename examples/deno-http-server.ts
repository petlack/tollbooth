import { serve } from 'https://deno.land/std@0.178.0/http/server.ts';
import { sendCommand } from 'https://deno.land/x/r2d2/mod.ts';
import { default as Tollbooth, setLimits, TollboothCode } from 'npm:tollbooth@^0.2';
import { RedisFromSendCommand } from 'npm:tollbooth@^0.2/deno.js';

const redisConn = await Deno.connect({ hostname: 'localhost', port: 6379 });

const redis = RedisFromSendCommand(redisConn, sendCommand);

const protect = Tollbooth.default({
  redis,
  routes: [{ path: '/foo', method: 'get' }],
});

const port = 8080;

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method && req.method.toLowerCase();
  const headers = req.headers;
  const tokenHeaderName = 'x-api-token';
  const token = tokenHeaderName && headers.get(tokenHeaderName);

  const response = await protect({ method, path, token });

  if (response.code !== TollboothCode.Ok) {
    return new Response(JSON.stringify({ data: null, errors: [{ message: response.message }] }), {
      status: response.statusCode,
    });
  }

  return new Response(JSON.stringify({ data: { status: 'ok' }, errors: null }), { status: 200 });
};

await setLimits(redis, [{ token: 'my_token', limit: 5 }]);

await serve(handler, { port });
