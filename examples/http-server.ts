import http, { ServerResponse, IncomingMessage } from 'http';
import Redis from 'ioredis';
import Tollbooth, { TollboothCode } from '../src';

const host = 'localhost';
const port = 8000;

const redis = new Redis('redis://localhost:6379');

const protect = Tollbooth({
  redis,
  routes: [{ method: 'get', path: '/foo' }],
});

const requestListener = async function (req: IncomingMessage, res: ServerResponse) {
  const path = req.url;
  const method = req.method && req.method.toLowerCase();
  const headers = req.headers;
  const clientHeaderName = 'x-api-token';
  const headerClient = clientHeaderName && headers[clientHeaderName];
  const token = headerClient && [...headerClient].join('');

  if (!path || !method) {
    res
      .setHeader('Content-Type', 'application/json')
      .writeHead(400)
      .end(JSON.stringify({ data: null, errors: [{ message: 'Bad request' }] }));
    return;
  }

  const response = await protect({ method, path, token });

  if (response.code !== TollboothCode.Ok) {
    res
      .setHeader('Content-Type', 'application/json')
      .writeHead(response.statusCode)
      .end(JSON.stringify({ data: null, errors: [{ message: response.message }] }));
    return;
  }

  res
    .setHeader('Content-Type', 'application/json')
    .writeHead(200)
    .end(JSON.stringify({ data: { status: 'ok' }, errors: null }));
};

const server = http.createServer(requestListener);
server.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`);
});
