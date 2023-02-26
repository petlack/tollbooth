import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  verbose: true,
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
};

export default config;
