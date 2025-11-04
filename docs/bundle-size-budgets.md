# Notes on bundle size budgets

Size-limit enforces budgets for both ESM and CJS entries, plus a coarse guard for the largest chunk. If you add a new heavy path, consider a dedicated budget entry. Update `.size-limit.cjs` accordingly.
