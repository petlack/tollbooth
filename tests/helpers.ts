import { APIGatewayEvent, APIGatewayProxyCallback, Context } from 'aws-lambda';

type Dict = { [k: string]: string };

export type AwsEventArgs = {
  method: string;
  path: string;
  body?: Dict;
  headers?: Dict;
  host?: string;
  query?: Dict;
};

function toMultiValue(dict: Dict) {
  return Object.keys(dict).reduce((res: { [k: string]: string[] }, item: string) => {
    res[item] = [dict[item]];
    return res;
  }, {});
}

export function awsEvent({
  path,
  method,
  query = {},
  headers = {},
  body = {},
  host,
}: AwsEventArgs): APIGatewayEvent {
  const domain = 'abcdef012';
  const accountId = '899899898999';
  const allHeaders = {
    accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'accept-encoding': 'gzip, deflate, br',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'cache-control': 'max-age=0',
    Host: host || 'example.com',
    'sec-ch-ua': '"Not?A_Brand";v="8", "Chromium";v="108", "Google Chrome";v="108"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    'X-Amzn-Trace-Id': 'Root=1-660022bb-3399559911ffdd4455aa22ee',
    'X-Forwarded-For': '192.168.0.1',
    'X-Forwarded-Port': '443',
    'X-Forwarded-Proto': 'https',
    ...headers,
  };
  return {
    resource: '/{proxy+}',
    path: path,
    httpMethod: method,
    headers: allHeaders,
    multiValueHeaders: toMultiValue(allHeaders),
    queryStringParameters: query,
    multiValueQueryStringParameters: toMultiValue(query),
    pathParameters: {
      proxy: 'confirm',
    },
    stageVariables: null,
    requestContext: {
      authorizer: null,
      resourceId: 't8v2w9',
      resourcePath: '/{proxy+}',
      httpMethod: 'GET',
      extendedRequestId: 'AbpcRHpiIAMFxxA=',
      requestTime: '16/Feb/2023:12:33:56 +0000',
      path: '/api/confirm',
      accountId: accountId,
      protocol: 'HTTP/1.1',
      stage: 'api',
      domainPrefix: domain,
      requestTimeEpoch: 1676550836631,
      requestId: '4766abc2-2404-481b-9b4f-5a68d537295a',
      identity: {
        apiKey: null,
        apiKeyId: null,
        clientCert: null,
        cognitoIdentityPoolId: null,
        accountId: null,
        cognitoIdentityId: null,
        caller: null,
        sourceIp: '192.168.0.1',
        principalOrgId: null,
        accessKey: null,
        cognitoAuthenticationType: null,
        cognitoAuthenticationProvider: null,
        userArn: null,
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        user: null,
      },
      ...(host ? { domainName: host } : {}),
      // domainName: host,
      apiId: domain,
    },
    body: body && JSON.stringify(body),
    isBase64Encoded: false,
  };
}

export function awsContext(): Context {
  /* istanbul ignore next */
  return {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    done: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    fail: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    succeed: () => {},
    getRemainingTimeInMillis: () => 0,
    callbackWaitsForEmptyEventLoop: true,
    functionVersion: '$LATEST',
    functionName: 'promo-suite-api',
    memoryLimitInMB: '128',
    logGroupName: '/aws/lambda/promo-suite-api',
    logStreamName: '2023/02/16/[$LATEST]fbf6d6e8cf964e87b32f438d216a22b4',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:890794846972:function:promo-suite-api',
    awsRequestId: '72d2650f-4c38-4b94-a602-1943d46a5975',
  };
}

function parse(result: { statusCode: number; body: string }) {
  return {
    statusCode: result.statusCode,
    body: JSON.parse(result.body),
  };
}

type Stub = jest.Mock<void>;

export function expectOneCall(stub: Stub, expected: unknown) {
  const calls = stub.mock.calls;
  expect(calls).toHaveLength(1);
  const response = calls[0];
  response[1] = parse(response[1]);
  expect(response).toEqual(expected);
}

export function expectStatus(stub: Stub, statusCode: number) {
  const calls = stub.mock.calls;
  expect(calls).toHaveLength(1);
  const result = parse(calls[0][1]);
  expect(result['statusCode']).toEqual(statusCode);
}

export function expectBody(stub: Stub, data: unknown) {
  const calls = stub.mock.calls;
  expect(calls).toHaveLength(1);
  const result = parse(calls[0][1]);
  expect(result['body']).toEqual(data);
}

export function expectData(stub: Stub, data: unknown) {
  const calls = stub.mock.calls;
  expect(calls).toHaveLength(1);
  const result = parse(calls[0][1]);
  expect(result['body']['data']).toEqual(data);
}

export function expectOneErrorMessage(stub: Stub, message: string) {
  const calls = stub.mock.calls;
  expect(calls).toHaveLength(1);
  const result = parse(calls[0][1]);
  expect(result['body']['errors']).toHaveLength(1);
  expect(result['body']['errors'][0]['message']).toEqual(message);
}

export function expectNoErrors(stub: Stub) {
  const calls = stub.mock.calls;
  expect(calls).toHaveLength(1);
  const result = parse(calls[0][1]);
  expect(result['body']['errors']).toBeNull();
}

type AwsHandler = (
  event: APIGatewayEvent,
  context: Context,
  callback: APIGatewayProxyCallback,
) => Promise<void>;

export function failHandler(e: unknown) {
  return async function () {
    throw e;
  };
}

export function okHandler(data: unknown) {
  return async function (
    _event: APIGatewayEvent,
    _context: Context,
    callback: APIGatewayProxyCallback,
  ) {
    callback(null, {
      statusCode: 200,
      body: JSON.stringify({
        data,
        errors: null,
      }),
    });
  };
}

export async function invokeLambda(handler: AwsHandler, args: AwsEventArgs) {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const stub = jest.fn(() => {});
  const context = awsContext();
  const event = awsEvent(args);
  await handler(event, context, stub);
  return stub;
}
