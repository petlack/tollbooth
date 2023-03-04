export type ProtectArgs = {
  method: string;
  path: string;
  token?: string | null;
};

export type Route = {
  path: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'options' | 'head' | 'delete';
};

export type CommandArg = string | number | Buffer;

export type Reply =
  | null
  | string
  | number
  | boolean
  | bigint
  | Buffer
  | Uint8Array
  | Uint16Array
  | Uint32Array
  | Record<string, unknown>
  | Reply[];

export interface RedisEval {
  eval: (
    script: string | Buffer,
    numkeys: string | number,
    ...args: CommandArg[]
  ) => Promise<unknown>;
}

export type TollboothArgs = {
  redis: RedisEval;
  routes: Route[];
  allowAnonymous?: boolean;
  debug?: boolean;
  failOnExceptions?: boolean;
  throttleEnabled?: boolean;
  throttleInterval?: number;
  throttleLimit?: number;
};

export type IndexedRoutes = Map<string, Map<string, boolean>>;

export enum TollboothCode {
  TooManyRequests = -3,
  Unauthorized = -2,
  LimitReached = -1,
  Ok = 0,
  RedisError = 1,
}

export type ProtectResponse = {
  code: TollboothCode;
  message: string;
  statusCode: number;
  info?: string | null;
};

export interface TollboothError {
  statusCode: number;
  message: string;
}

export const UNLIMITED = -1;
