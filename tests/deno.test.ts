import { RedisFromSendCommand } from '../src/deno';

function sendCommand(conn: string, args: (string | number)[]) {
  return [conn, ...args];
}

const redis = RedisFromSendCommand('conn', sendCommand);

describe('RedisFromSendCommand', () => {
  it('hget', () => {
    expect(
      redis.hget('foo', 'bar')
    ).toEqual(
      ['conn', 'HGET', 'foo', 'bar']
    );
  });

  it('eval', () => {
    expect(
      redis.eval('return KEYS[0] .. ARGV[1]', 1, 'foo', 'bar')
    ).toEqual(
      ['conn', 'EVAL', 'return KEYS[0] .. ARGV[1]', 1, 'foo', 'bar']
    );
  });
});

