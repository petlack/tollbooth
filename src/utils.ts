import { TollboothCode } from './types';
import type { IndexedRoutes, Route, ProtectArgs, ProtectResponse } from './types';

export function getMessage(e: { message?: string }, def = 'Unknown Error') {
  if (e instanceof Error) {
    return e.message;
  }
  return (e && e.message) || def;
}

export function getStatusCode(e: { statusCode?: number }, def = 500) {
  return (e && e.statusCode) || def;
}

export function codeToName(code: TollboothCode): string {
  const name = Object.keys(TollboothCode).find(
    (key: string) => TollboothCode[key as keyof typeof TollboothCode] === code,
  );
  return name || 'Unknown';
}

export function redisToCode(res: string | null): TollboothCode {
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
    res.get(path)?.set(method, true);
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
