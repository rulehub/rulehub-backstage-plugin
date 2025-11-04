/**
 * Backstage core-components mock (test-only).
 *
 * Why: the real @backstage/core-components pulls in heavy UI deps (Material UI, material-table),
 * which are slow and sometimes ESM-only in Jest (CommonJS) environments. This mock keeps tests
 * fast and stable by returning lightweight React elements with data-testid hooks.
 *
 * Upgrade notes (Backstage may change):
 * - Table API: columns/data/render signatures can evolve (e.g., material-table -> MUI DataGrid).
 *   Our mock only uses the minimal subset: props.title, props.columns, props.data, and optional
 *   column.render callback for the FIRST row, to let tests assert basic rendering.
 * - Progress/WarningPanel/Button props could change; the mock exposes only what our tests need.
 *
 * If Backstage updates break tests, prefer adapting this file rather than touching test cases.
 * Exported surface (kept intentionally small): { Table, Progress, WarningPanel, Button, Link }
 */
import React from 'react';

const extractText = (node: any): string => {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (React.isValidElement(node)) return extractText((node as any).props?.children);
  return '';
};

const Table = (props: any) => {
  const first = Array.isArray(props.data) && props.data.length > 0 ? props.data[0] : undefined;
  // Emulate real table expectations: data rows should be objects. Throw to catch issues in tests.
  if (
    Array.isArray(props.data) &&
    props.data.some((r: any) => r == null || typeof r !== 'object')
  ) {
    throw new TypeError('Table received non-object row');
  }
  const renderedCells = Array.isArray(props.columns)
    ? props.columns.map((col: any) => {
        try {
          if (col?.render && first) {
            return extractText(col.render(first));
          }
          const field = col?.field;
          return field && first ? String((first as any)[field] ?? '') : '';
        } catch {
          return '';
        }
      })
    : [];

  // Create real elements for render() outputs of the first row so tests can query anchors
  const firstRowRendered = Array.isArray(props.columns)
    ? props.columns.map((col: any, idx: number) => {
        try {
          if (col?.render && first) {
            const node = col.render(first);
            return React.createElement('div', { key: `c-${idx}` }, node);
          }
          const field = col?.field;
          const text = field && first ? String((first as any)[field] ?? '') : '';
          return React.createElement('div', { key: `c-${idx}` }, text);
        } catch {
          return React.createElement('div', { key: `c-${idx}` }, '');
        }
      })
    : [];

  return React.createElement(
    React.Fragment,
    null,
    React.createElement('div', { 'data-testid': 'table-title' }, props.title),
    React.createElement(
      'div',
      { 'data-testid': 'table-columns' },
      JSON.stringify(props.columns, (k, v) => (typeof v === 'function' ? '[Function]' : v)),
    ),
    React.createElement('div', { 'data-testid': 'table-data' }, JSON.stringify(props.data)),
    React.createElement('div', { 'data-testid': 'table-rendered-cells' }, renderedCells.join('|')),
    React.createElement('div', { 'data-testid': 'table-first-row-rendered' }, firstRowRendered),
  );
};

const Progress = () => React.createElement('div', { 'data-testid': 'progress' });

const WarningPanel = (props: any) =>
  React.createElement('div', { 'data-testid': 'warning-panel' }, props.children);

const Button = (props: any) =>
  React.createElement('button', { onClick: props.onClick }, props.children);

// Minimal Link mock compatible with Backstage Link API (expects `to` prop)
const Link = (props: any) =>
  React.createElement(
    'a',
    {
      'data-testid': 'link',
      'data-href': props.to, // expose as data attribute for easier test assertions
      href: props.to,
      title: props.title,
      'aria-label': props['aria-label'],
    },
    props.children,
  );

// Default export object for consumption via require(...).default in jest.mock factory
const defaultExport = { Table, Progress, WarningPanel, Button, Link };
export default defaultExport;
