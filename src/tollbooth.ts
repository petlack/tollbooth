import { getMessage } from './utils';

import { TollboothCode } from './types';
import type { IndexedRoutes, Route, ProtectArgs, TollboothArgs, ProtectResponse } from './types';

function codeToName(code: TollboothCode): string {
  const name = Object.keys(TollboothCode).find(
    (key: string) => TollboothCode[key as keyof typeof TollboothCode] === code,
  );
  return name || 'Unknown';
}

function getCode(res: any): TollboothCode {
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

function codeToStatus(code: TollboothCode): number {
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

function filterNil(obj: any): any {
  return Object.entries(obj).reduce(
    (res: any, [k, v]: [k: any, v: any]) => ({ ...res, ...(v == null ? {} : { [k]: v }) }),
    {},
  );
}

function codeToResponse(code: TollboothCode, info?: any): ProtectResponse {
  return filterNil({ code, message: codeToName(code), statusCode: codeToStatus(code), info });
}

function indexRoutes(paths: Route[]): IndexedRoutes {
  return paths.reduce((res: IndexedRoutes, { path, method }) => {
    if (!res.has(path)) {
      res.set(path, new Map());
    }
    res.get(path)?.set(method, true);
    return res;
  }, new Map());
}

function noop() {}
type LogArgs = ProtectArgs & {
  msg: string;
};

function logEvent({ method, path, token, msg }: LogArgs) {
  console.log('= Tollbooth debug =');
  console.log(`token=${token} method=${method} path=${path}`);
  console.log(`${msg}`);
  console.log('===================');
}

const TOLLBOOTH_SCRIPT = `
  local limit_table = KEYS[1]
  local token = ARGV[1]
  local throttle_interval = tonumber(ARGV[2] or '-1')
  local throttle_limit = tonumber(ARGV[3] or '-1')

  local step = token ~= 'anonymous' and -1 or 0
  local current_limit = redis.call('HGET', limit_table, token)
  
  if current_limit == false then
    return ${TollboothCode.Unauthorized}
  end

  current_limit = tonumber(current_limit)

  if current_limit <= 0 then
    return ${TollboothCode.LimitReached}
  end

  if throttle_interval > 0 and throttle_limit > 0 then
    local token_throttle_key = KEYS[2]

    local throttle_requests = tonumber(redis.call('INCRBY', token_throttle_key, 1))

    if throttle_requests > throttle_limit then
      return ${TollboothCode.TooManyRequests}
    end
    
    if throttle_requests == 1 then
      redis.call('EXPIRE', token_throttle_key, throttle_interval)
    end
  end

  local new_limit = current_limit + step

  redis.call('HSET', limit_table, token, new_limit)

  return new_limit
`;

const TOLLBOOTH_SCRIPT_KEYS = 2;
const TOLLBOOTH_LIMIT_TABLE = '_fact:limit';
const TOLLBOOTH_THROTTLE_TABLE = '_fact:throttle';

export default function Tollbooth({
  redis,
  routes,
  debug = false,
  allowAnonymous = false,
  throttleEnabled = true,
  throttleInterval = 1,
  throttleLimit = 10,
  failOnExceptions = true,
}: TollboothArgs) {
  const indexedRoutes = indexRoutes(routes);
  const protectingAll = !!routes.find(({ path }) => path === '*');
  const isProtected = (path: string, method: string) =>
    indexedRoutes.get(protectingAll ? '*' : path)?.get(method);

  const log = debug ? logEvent : noop;

  return async function (args: ProtectArgs): Promise<ProtectResponse> {
    let code = TollboothCode.RedisError;
    let info = null;

    try {
      const { token, path, method } = args;

      log({ ...args, msg: '' });

      if (!isProtected(path, method)) {
        log({ ...args, msg: 'unprotected path' });
        return codeToResponse(TollboothCode.Ok);
      }

      if (!token && !allowAnonymous) {
        log({ ...args, msg: 'unauthorized - no client token & not allowing anonymous' });
        return codeToResponse(TollboothCode.Unauthorized);
      }

      const tokenOrAnonymous = token || 'anonymous';

      const res = await redis.eval(
        TOLLBOOTH_SCRIPT,
        TOLLBOOTH_SCRIPT_KEYS,
        TOLLBOOTH_LIMIT_TABLE,
        `${TOLLBOOTH_THROTTLE_TABLE}:${tokenOrAnonymous}`,
        tokenOrAnonymous,
        throttleEnabled ? throttleInterval : -1,
        throttleEnabled ? throttleLimit : -1,
      );
      code = getCode(res);
    } catch (e: any) {
      log({ ...args, msg: getMessage(e) });
      if (failOnExceptions) {
        info = e.message;
        code = TollboothCode.RedisError;
      } else {
        code = TollboothCode.Ok;
      }
    }

    switch (code) {
      case TollboothCode.TooManyRequests:
        log({ ...args, msg: 'too many requests' });
      case TollboothCode.LimitReached:
        log({ ...args, msg: 'limit reached' });
    }

    return codeToResponse(code, info);
  };
}
