import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';

const config = [
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: true,
    },
    plugins: [esbuild()]
  },
  {
    input: 'src/express.ts',
    output: {
      file: 'dist/express/index.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: true,
    },
    plugins: [esbuild()]
  },
  {
    input: 'src/lambda.ts',
    output: {
      file: 'dist/lambda/index.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: true,
    },
    plugins: [esbuild()]
  },
  {
    input: 'src/deno.ts',
    output: {
      file: 'dist/deno.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: true,
    },
    plugins: [esbuild()]
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es'
    },
    plugins: [dts()]
  },
  {
    input: 'src/express.ts',
    output: {
      file: 'dist/express/index.d.ts',
      format: 'es'
    },
    plugins: [dts()]
  },
  {
    input: 'src/lambda.ts',
    output: {
      file: 'dist/lambda/index.d.ts',
      format: 'es'
    },
    plugins: [dts()]
  },
  {
    input: 'src/deno.ts',
    output: {
      file: 'dist/deno.d.ts',
      format: 'es'
    },
    plugins: [dts()]
  },
];

export default config;