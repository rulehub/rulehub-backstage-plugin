// Size Limit configuration (RuleHub plugin)
// Keep core entry modest and add headroom for future optional chunks.
module.exports = [
  {
    name: 'core ESM entry',
    path: 'dist/index.mjs',
    limit: '75 KB',
  },
  {
    name: 'core CJS entry',
    path: 'dist/index.js',
    limit: '75 KB',
  },
  // If in the future we introduce lazy chunks (e.g., validation or heavy tables),
  // keep an eye on the largest chunk as a coarse guardrail.
  {
    name: 'largest chunk (if any)',
    path: 'dist/chunk-*.mjs',
    limit: '90 KB',
  },
];
