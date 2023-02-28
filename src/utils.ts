import { TollboothCode } from './types';
import type { IndexedRoutes, Route, ProtectArgs, ProtectResponse } from './types';

export function getMessage(e: any, def = 'Unknown Error') {
  if (e instanceof Error) {
    return e.message;
  }
  return (e && e.message) || def;
}

export function getStatusCode(e: any, def = 500) {
  return (e && e.statusCode) || def;
}

export function codeToName(code: TollboothCode): string {
  const name = Object.keys(TollboothCode).find(
    (key: string) => TollboothCode[key as keyof typeof TollboothCode] === code,
  );
  return name || 'Unknown';
}

export function redisToCode(res: any): TollboothCode {
  if (res == null) {
    return TollboothCode.RedisError;
  }
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

export function filterNil(obj: any): any {
  return Object.entries(obj).reduce(
    (res: any, [k, v]: [k: any, v: any]) => ({ ...res, ...(v == null ? {} : { [k]: v }) }),
    {},
  );
}

export function codeToResponse(code: TollboothCode, info?: any): ProtectResponse {
  return filterNil({ code, message: codeToName(code), statusCode: codeToStatus(code), info });
}

export function indexRoutes(paths: Route[]): IndexedRoutes {
  return paths.reduce((res: IndexedRoutes, { path, method }) => {
    if (!res.has(path)) {
      res.set(path, new Map());
    }
    res.get(path)?.set(method, true);
    return res;
  }, new Map());
}

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
