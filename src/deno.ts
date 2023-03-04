type Fn<I, O> = (...args: I[]) => O;
type CmdFn<I, O> = (cmd: string, ...args: I[]) => O;

type CommandArg =
  | string
  | number;

type Reply = 
  | string
  | number
  | boolean
  | bigint
  | Uint8Array
  | Uint16Array
  | Uint32Array
  | Record<string, unknown>
  | Reply[];

type SendCommandFn<I extends CommandArg, T> = (conn: T, args: I[]) => Reply;

export function mapFunctionsToKeys<I, O, T extends Fn<I, O>, K extends string>(
  fn: CmdFn<I, O>,
  cmds: K[],
): { [P in K as P]: T } {
  return cmds.reduce((res, cmd) => {
    return { ...res, [cmd]: (...args: I[]) => fn(cmd, ...args) };
  }, {} as { [P in K as P]: T });
}

const REDIS_COMMANDS = ['eval', 'hset', 'hget', 'hdel', 'keys', 'del'];

export function RedisFromSendCommand<I extends CommandArg, O, T>(
  conn: T,
  sendCommand: SendCommandFn<I, T>,
) {
  return mapFunctionsToKeys((cmd, ...args: I[]) => {
    return <O>sendCommand(conn, [cmd.toUpperCase() as I, ...args]);
  }, REDIS_COMMANDS);
}
