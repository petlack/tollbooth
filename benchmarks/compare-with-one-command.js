import Redis from 'ioredis';
import benchmark from 'benchmark';
import Tollbooth, { setTokensLimits, evict, TollboothCode } from '../dist/index';

const redis = new Redis('redis://localhost:6379');

let scalarRuns = 0;
let protectRuns = 0;

async function incrByScalar(field) {
  scalarRuns += 1;
  await redis.hincrby('bench:counter', field, 2);
}

const protectedRequest = (token) => ({ path: '/foo', token, method: 'get' });

const protect = Tollbooth({
  redis,
  routes: [{ path: '/foo', method: 'get' }],
  allowAnonymous: false,
  throttleLimit: 100_000,
});

async function runProtect(token) {
  protectRuns += 1;
  const res = await protect(protectedRequest(token));
  if (res.code !== TollboothCode.Ok) {
    console.log('fail', res.message);
  }
}

function round(x, n = 2, lp = 0) {
  const res = Math.round(x * 10 ** +n) / 10 ** +n;
  if (lp > 0) {
    return `${res}`.padStart(lp, '0');
  }
  return res;
}

function formatDuration(seconds) {
  if (isNaN(seconds)) {
    return '--:--';
  }
  let secs = +seconds;
  if (secs < 20) {
    return `${seconds * 1000} ms`;
  }
  let mins = Math.floor(secs / 60);
  secs = secs - mins * 60;
  if (mins < 60) {
    return `${round(mins, 0, 2)}:${round(secs, 0, 2)}`;
  }
  let hours = Math.floor(mins / 60);
  mins = mins - hours * 60;
  return `${round(hours, 0, 2)}:${round(mins, 0, 2)}:${round(secs, 0, 2)}`;
}

async function getNumberOfCalls(redis) {
  const res = await redis.info('commandstats');
  const stats = res
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l.length && l[0] !== '#')
    .map((item) => parseFloat(item.split(',')[0].split('=')[1]));
  const calls = stats.reduce((a, b) => a + b);
  return calls;
}

async function run() {
  try {
    await setTokensLimits(redis, [{ token: 'ClientToken', limit: 100_000 }]);

    let calls = [(await getNumberOfCalls(redis)) - 1];

    const suite = new benchmark.Suite();
    suite.add('incrByScalar', {
      defer: true,
      fn: async (deferred) => {
        await incrByScalar('test');
        deferred.resolve();
      },
    });
    suite.add('protect', {
      defer: true,
      fn: async (deferred) => {
        await runProtect('ClientToken');
        deferred.resolve();
      },
    });
    suite.on('cycle', async (event) => {
      const callsMid = await getNumberOfCalls(redis);
      calls.push(callsMid - 1);
      console.log(String(event.target));
    });
    suite.on('complete', async () => {
      calls.push((await getNumberOfCalls(redis)) - 1);
      const [callsStart, callsMid, callsEnd] = calls;

      console.log(
        `incrByScalar x ${scalarRuns.toLocaleString()} calls took ${formatDuration(
          suite[0].times.elapsed,
        )}, made ${(callsMid - callsStart).toLocaleString()} redis calls`,
      );
      console.log(
        `protect x ${protectRuns.toLocaleString()} calls took ${formatDuration(
          suite[1].times.elapsed,
        )}, made ${(callsEnd - callsMid).toLocaleString()} redis calls`,
      );

      console.log('total redis calls', (callsEnd - callsStart).toLocaleString());

      await evict(redis);
      process.exit();
    });
    return suite.run({ async: true });
  } catch (e) {
    console.error(e);
    throw e;
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
