import { Redis } from 'ioredis';
class CustomRedisClient extends Redis {
  incrByHashValue(key1: string, key2: string): Promise<number> {
    return this.sendCommand('incrByValue', [key1, key2]);
  }
}
