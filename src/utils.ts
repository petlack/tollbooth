export function getMessage(e: any, def = 'Unknown Error') {
  if (e instanceof Error) {
    return e.message;
  }
  return (e && e.message) || def;
}

export function getStatusCode(e: any, def = 500) {
  return (e && e.statusCode) || def;
}
