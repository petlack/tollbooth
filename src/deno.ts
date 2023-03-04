import { CommandArg, Reply } from './types';

type Fn<I, O> = (...args: I[]) => O;
type CmdFn<I, O> = (cmd: string, ...args: I[]) => O;

type SendCommandFn<I extends CommandArg, T, R extends Reply> = (
  conn: T,
  args: I[],
) => Promise<R>;

export function mapFunctionsToKeys<I, O, T extends Fn<I, O>, K extends string>(
  fn: CmdFn<I, O>,
  cmds: K[],
): { [P in K as P]: T } {
  return cmds.reduce((res, cmd) => {
    return { ...res, [cmd]: (...args: I[]) => fn(cmd, ...args) };
  }, {} as { [P in K as P]: T });
}

export function RedisFromSendCommand<I extends CommandArg, T, R extends Reply>(
  conn: T,
  sendCommand: SendCommandFn<I, T, R>,
) {
  return mapFunctionsToKeys(
    (cmd, ...args: I[]) => {
      return sendCommand(conn, [cmd.toUpperCase() as I, ...args]);
    },
    ['eval', 'hset', 'hget', 'hdel', 'keys', 'del'],
  );
}
