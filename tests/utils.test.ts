import { TollboothCode } from '../src';
import { codeToName, toError } from '../src/utils';

describe('codeToName', () => {
  test('correct code', () => {
    expect(codeToName(TollboothCode.LimitReached)).toEqual('LimitReached');
  });
  test('incorrect code', () => {
    expect(codeToName(42)).toEqual('Unknown');
  });
});

describe('toError', () => {
  test('null or empty', () => {
    expect(toError(null)).toEqual({ message: 'unknown error null', statusCode: 500 });
    expect(toError(undefined)).toEqual({ message: 'unknown error undefined', statusCode: 500 });
    expect(toError({})).toEqual({ message: 'unknown error with keys []', statusCode: 500 });
    expect(toError([])).toEqual({ message: 'unknown error with keys []', statusCode: 500 });
    expect(toError('')).toEqual({ message: '', statusCode: 500 });
    expect(toError(NaN)).toEqual({ message: 'NaN', statusCode: 500 });
    expect(toError(false)).toEqual({ message: 'false', statusCode: 500 });
    expect(toError(0)).toEqual({ message: '0', statusCode: 500 });
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    expect(toError(() => {})).toEqual({ message: 'unknown error () => { }', statusCode: 500 });
    expect(
      toError(
        new Promise<void>((resolve) => {
          resolve();
        }),
      ),
    ).toEqual({ message: 'unknown error with keys []', statusCode: 500 });
  });

  test('missing message', () => {
    expect(toError({ statusCode: 404 })).toEqual({ message: '404', statusCode: 404 });
  });

  test('missing status', () => {
    expect(toError({ message: 'error' })).toEqual({ message: 'error', statusCode: 500 });
  });

  test('exceptions', () => {
    expect(toError(new Error('missing token'))).toEqual({
      message: 'missing token',
      statusCode: 500,
    });
  });
});
