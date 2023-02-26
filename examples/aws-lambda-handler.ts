import { Context, APIGatewayProxyCallback, APIGatewayEvent } from 'aws-lambda';
import Redis from 'ioredis';
import Tollbooth from '../src/lambda';

const redis = new Redis('redis://localhost:6379');

const protect = Tollbooth({
  redis,
  routes: [{ path: '/foo', method: 'get' }],
});

function handle(_event: APIGatewayEvent, _context: Context, callback: APIGatewayProxyCallback) {
  callback(null, {
    statusCode: 200,
    body: JSON.stringify({ status: 'ok' }),
  });
}

export const handler = protect(handle);
