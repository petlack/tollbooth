import express from 'express';
import Redis from 'ioredis';
import Tollbooth from '../src/express';
import { setTokensLimits } from '../src';

const redis = new Redis('redis://localhost');

const app = express();

app.use(express.json());

app.use(
  Tollbooth({
    redis,
    routes: [{ path: '/foo', method: 'get' }],
  }),
);

app.get('/foo', (_req, res) => {
  res.send({ data: { status: 'ok' }, errors: null });
});

app.get('/bar', (_req, res) => {
  res.send({ data: { status: 'foo' }, errors: null });
});

setTokensLimits(redis, [{ token: 'my_token', limit: 5 }]).then(() => {
  app.listen(5005, () => {
    console.log('Listening on port 5005');
  });
});
