import { codeToResponse, redisToCode, indexRoutes, logEvent, noop, toError } from './utils';

import { TollboothCode, UNLIMITED } from './types';
import type { ProtectArgs, TollboothArgs, ProtectResponse } from './types';

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

  if current_limit == ${UNLIMITED} then
    return 1
  end

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
const TOLLBOOTH_LIMIT_TABLE = '_tollbooth:limit';
const TOLLBOOTH_THROTTLE_TABLE = '_tollbooth:throttle';

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
      if (typeof res === 'string' || res instanceof String) {
        code = redisToCode(<string>res);
      } else if (typeof res === 'number') {
        code = redisToCode(res.toString());
      } else {
        // info = `Unknown response ${res}`;
        code = TollboothCode.RedisError;
      }
    } catch (e: unknown) {
      const err = toError(e);
      log({ ...args, msg: err.message });
      if (failOnExceptions) {
        info = err.message;
        code = TollboothCode.RedisError;
      } else {
        code = TollboothCode.Ok;
      }
    }

    switch (code) {
      case TollboothCode.TooManyRequests:
        log({ ...args, msg: 'too many requests' });
        break;
      case TollboothCode.LimitReached:
        log({ ...args, msg: 'limit reached' });
        break;
    }

    return codeToResponse(code, info);
  };
}
