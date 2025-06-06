import { Context, APIGatewayProxyCallback, APIGatewayEvent } from 'aws-lambda';

import Tollbooth from './tollbooth';
import { TollboothArgs, TollboothCode, TollboothError } from './types';
import { toError } from './utils';

function fail(error: TollboothError) {
  const body = {
    errors: [{ message: error.message }],
    data: null,
  };

  return { statusCode: error.statusCode, body: JSON.stringify(body) };
}

type AwsHandler = (
  event: APIGatewayEvent,
  context: Context,
  callback: APIGatewayProxyCallback,
) => void | Promise<void>;

type LambdaErrorHandler = (callback: APIGatewayProxyCallback, error: TollboothError) => void;

export type LambdaTollboothArgs = TollboothArgs & {
  tokenHeaderName?: string;
  errorHandler?: LambdaErrorHandler;
};

export default function ({
  tokenHeaderName = 'x-api-key',
  errorHandler,
  ...args
}: LambdaTollboothArgs) {
  const protect = Tollbooth(args);

  function handleError(callback: APIGatewayProxyCallback, error: TollboothError) {
    if (errorHandler) {
      errorHandler(callback, error);
      return;
    }

    callback(null, fail(error));
  }

  return function (handler: AwsHandler) {
    return async function handle(
      event: APIGatewayEvent,
      context: Context,
      callback: APIGatewayProxyCallback,
    ) {
      const token = tokenHeaderName ? event.headers?.[tokenHeaderName] : undefined;
      const method = event.httpMethod.toLowerCase();
      const path = event.path;

      try {
        const result = await protect({ token, path, method });
        if (result.code !== TollboothCode.Ok) {
          handleError(callback, result);
          return;
        }
        await handler(event, context, callback);
      } catch (e: unknown) {
        const err = toError(e);
        handleError(callback, err);
      }
    };
  };
}
