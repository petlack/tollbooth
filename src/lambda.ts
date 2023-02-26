import { Context, APIGatewayProxyCallback, APIGatewayEvent } from 'aws-lambda';

import Tollbooth from './tollbooth';
import { TollboothArgs, TollboothCode, TollboothError } from './types';
import { getMessage, getStatusCode } from './utils';

function fail(error: any) {
  const body = {
    errors: [{ message: getMessage(error) }],
    data: null,
  };

  return { statusCode: getStatusCode(error), body: JSON.stringify(body) };
}

type AwsHandler = (
  event: APIGatewayEvent,
  context: Context,
  callback: APIGatewayProxyCallback,
) => void | Promise<void>;

type LambdaErrorHandler = (callback: APIGatewayProxyCallback, error: TollboothError) => void;

export type LambdaTollboothArgs = TollboothArgs & {
  clientHeaderName?: string;
  errorHandler?: LambdaErrorHandler;
};

export default function ({
  clientHeaderName = 'x-api-key',
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
      const token = (clientHeaderName && event.headers[clientHeaderName]) || undefined;
      const method = event.httpMethod.toLowerCase();
      const path = event.path;

      try {
        const result = await protect({ token, path, method });
        if (result.code !== TollboothCode.Ok) {
          handleError(callback, result);
          return;
        }
        await handler(event, context, callback);
      } catch (e: any) {
        handleError(callback, e);
      }
    };
  };
}
