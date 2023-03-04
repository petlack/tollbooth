import { TollboothCode } from './types';
import type { IndexedRoutes, Route, ProtectArgs, ProtectResponse } from './types';

export function codeToName(code: TollboothCode): string {
  const name = Object.keys(TollboothCode).find(
    (key: string) => TollboothCode[key as keyof typeof TollboothCode] === code,
  );
  return name || 'Unknown';
}

export function redisToCode(res: string): TollboothCode {
  const num = parseInt(res);
  if (num >= 0) {
    return TollboothCode.Ok;
  }
  if (Object.values(TollboothCode).includes(num)) {
    return num;
  }
  return TollboothCode.RedisError;
}

export function codeToStatus(code: TollboothCode): number {
  switch (code) {
  case TollboothCode.TooManyRequests:
    return 429;
  case TollboothCode.Unauthorized:
    return 401;
  case TollboothCode.LimitReached:
    return 429;
  case TollboothCode.RedisError:
    return 500;
  case TollboothCode.Ok:
    return 200;
  }
}

export function filterNil<T extends {[k: string]: string | number | null}>(obj: T): T {
  return Object.entries(obj).reduce(
    (res, [k, v]) => ({ ...res, ...(v == null ? {} : { [k]: v }) }),
    <T>{},
  );
}

export function codeToResponse(code: TollboothCode, info?: string | null): ProtectResponse {
  return filterNil<ProtectResponse>({ code, message: codeToName(code), statusCode: codeToStatus(code), info });
}

export function indexRoutes(paths: Route[]): IndexedRoutes {
  return paths.reduce((res: IndexedRoutes, { path, method }) => {
    if (!res.has(path)) {
      res.set(path, new Map());
    }
    const route = res.get(path);
    if (route) {
      route.set(method, true);
    }
    return res;
  }, new Map());
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function noop() {}

type LogArgs = ProtectArgs & {
  msg: string;
};

export function logEvent({ method, path, token, msg }: LogArgs) {
  console.log('= Tollbooth debug =');
  console.log(`token=${token} method=${method} path=${path}`);
  console.log(`${msg}`);
  console.log('===================');
}

function pullAttr<T>(obj: object, name: string) {
  if (name in obj) {
    return obj as T;
  }
  return <T>{
    [name]: null,
  };
}

export function toError(obj: unknown): { message: string, statusCode: number } {
  if (typeof obj === 'object' && obj !== null) {
    const { message: msg } = pullAttr<{ message: string | null }>(obj, 'message');
    const { statusCode: status } = pullAttr<{ statusCode: number | null }>(obj, 'statusCode');
    if (msg && status) {
      return { message: msg, statusCode: status };
    }
    if (msg && !status) {
      return { message: msg, statusCode: 500 };
    }
    if (!msg && status) {
      return { message: status.toString(), statusCode: status };
    }
    return { message: `unknown error with keys [${Object.keys(obj).join(' ')}]`, statusCode: 500 };
  }
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean' || obj instanceof Date) {
    return { message: obj.toString(), statusCode: 500 };
  }
  return { message: `unknown error ${obj}`, statusCode: 500 };
}