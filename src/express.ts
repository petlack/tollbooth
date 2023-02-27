import { Request, Response, NextFunction } from 'express';
import Tollbooth from './tollbooth';
import { TollboothCode, TollboothArgs, TollboothError } from './types';

type ExpressErrorHandler = (res: Response, error: TollboothError) => void;

export type ExpressTollboothArgs = TollboothArgs & {
  tokenHeaderName?: string;
  errorHandler?: ExpressErrorHandler;
};

export default function ExpressTollbooth({
  tokenHeaderName = 'x-api-key',
  errorHandler,
  ...args
}: ExpressTollboothArgs) {
  const protect = Tollbooth(args);

  function handleError(res: Response, error: TollboothError) {
    if (errorHandler) {
      errorHandler(res, error);
      return;
    }

    res.status(error.statusCode).json({
      data: null,
      errors: [{ message: error.message }],
    });
  }

  return async function (req: Request, res: Response, next: NextFunction) {
    const path = req.url;
    const method = req.method.toLowerCase();
    const headers = req.headers;
    const headerClient = tokenHeaderName && headers[tokenHeaderName];
    const token = headerClient && [...headerClient].join('');

    const result = await protect({ path, token, method });
    if (result.code !== TollboothCode.Ok) {
      handleError(res, result);
      return;
    }

    next();
  };
}
