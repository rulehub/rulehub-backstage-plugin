import { defineConfig } from 'tsup';

const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: { entry: 'src/index.ts' },
  // External source maps improve DX without affecting bundle size
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: true,
  // Minify only for production builds to keep local dev fast
  minify: isProd,
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@backstage/core-components',
    '@backstage/core-plugin-api',
  ],
  target: 'es2022',
  esbuildOptions: (options) => {
    if (isProd) (options as any).drop = ['console'];
  },
});
