import { RulehubClient } from '../src/RulehubClient';
import { ERROR_CODES } from '../src/errors';

const originalFetch = (global as any).fetch as any;

type MockFetchInput = { ok?: boolean; status?: number; statusText?: string; body?: any } | Error;
function mockFetchOnce(res: MockFetchInput) {
  (global as any).fetch = jest.fn().mockImplementation((_url: string, opts?: any) => {
    if (res instanceof Error) {
      return Promise.reject(res);
    }
    const { body = {}, ok = true, status = 200, statusText = 'OK' } = res as any;
    if (opts?.signal?.aborted) {
      const err: any = new Error('aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    }
    return Promise.resolve({ ok, status, statusText, json: async () => body } as Response);
  });
}

function mockFetchSequence(responses: MockFetchInput[]) {
  const queue = [...responses];
  (global as any).fetch = jest.fn().mockImplementation((_url: string, opts?: any) => {
    const res = queue.shift();
    if (!res) {
      return Promise.reject(new Error('No more mock responses'));
    }
    if (res instanceof Error) {
      return Promise.reject(res);
    }
    const { body = {}, ok = true, status = 200, statusText = 'OK' } = res as any;
    if (opts?.signal?.aborted) {
      const err: any = new Error('aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    }
    return Promise.resolve({ ok, status, statusText, json: async () => body } as Response);
  });
}

describe('RulehubClient', () => {
  beforeEach(() => {
    RulehubClient.instance.clearCache();
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('fetches, validates legacy items shape, normalizes and caches', async () => {
    mockFetchOnce({ body: { items: [{ id: 'a', name: 'A', standard: 'STD', version: '1' }] } });
    const url = '/index.json';
    const first = await RulehubClient.getIndex(url);
    expect(first).toEqual([
      expect.objectContaining({ id: 'a', name: 'A', standard: 'STD', version: '1' }),
    ]);
    const second = await RulehubClient.getIndex(url);
    expect(second).toEqual(first);
    expect((global as any).fetch).toHaveBeenCalledTimes(1);
  });

  it('supports array jurisdiction -> joined string and array industry passthrough', async () => {
    mockFetchOnce({
      body: {
        packages: [
          {
            id: 'pkg',
            name: 'Name',
            standard: 'S',
            version: 'v',
            jurisdiction: ['EU', 'US'],
            industry: ['finance', 'healthcare'],
          },
        ],
      },
    });
    const out = await RulehubClient.getIndex('/x');
    expect(out[0].jurisdiction).toBe('EU, US');
    expect((out[0] as any).industry).toEqual(['finance', 'healthcare']);
  });

  it('throws on HTTP error with proper code', async () => {
    mockFetchOnce({ ok: false, status: 404, statusText: 'Not Found', body: {} });
    await expect(RulehubClient.getIndex('/bad')).rejects.toMatchObject({
      code: ERROR_CODES.INDEX_HTTP_ERROR,
    });
  });

  it('throws on invalid schema (missing packages/items)', async () => {
    mockFetchOnce({ body: { foo: 'bar' } });
    await expect(RulehubClient.getIndex('/bad-schema')).rejects.toMatchObject({
      code: ERROR_CODES.INDEX_SCHEMA_INVALID,
    });
  });

  it('propagates aborts as INDEX_ABORTED', async () => {
    const controller = new AbortController();
    controller.abort();
    mockFetchOnce({ body: {} });
    await expect(RulehubClient.getIndex('/abort', controller.signal)).rejects.toMatchObject({
      code: ERROR_CODES.INDEX_ABORTED,
    });
  });

  it('maps fetch network errors to INDEX_HTTP_ERROR', async () => {
    const err = new TypeError('fetch failed');
    mockFetchOnce(err);
    await expect(RulehubClient.getIndex('/neterr')).rejects.toMatchObject({
      code: ERROR_CODES.INDEX_HTTP_ERROR,
    });
  });

  it('maps unknown errors to INDEX_UNKNOWN', async () => {
    mockFetchOnce(new Error('boom'));
    await expect(RulehubClient.getIndex('/unknown')).rejects.toMatchObject({
      code: ERROR_CODES.INDEX_UNKNOWN,
    });
  });

  it('clearCache empties the cache', async () => {
    mockFetchOnce({ body: { packages: [{ id: 'a', name: 'A', standard: 'STD', version: '1' }] } });
    const url = '/cache';
    await RulehubClient.getIndex(url);
    expect((global as any).fetch).toHaveBeenCalledTimes(1);
    RulehubClient.instance.clearCache();
    mockFetchOnce({ body: { packages: [{ id: 'a', name: 'A', standard: 'STD', version: '1' }] } });
    await RulehubClient.getIndex(url);
    expect((global as any).fetch).toHaveBeenCalledTimes(1);
  });

  it('respects TTL override: TTL=0 disables cache', async () => {
    // two distinct responses to prove both requests hit fetch
    mockFetchSequence([
      { body: { packages: [{ id: 't1', name: 'T1', standard: 'S', version: '1' }] } },
      { body: { packages: [{ id: 't2', name: 'T2', standard: 'S', version: '1' }] } },
    ]);
    // Force no caching
    RulehubClient.instance.setCacheTTL(0);
    const url = '/ttl0';
    const r1 = await RulehubClient.getIndex(url);
    const r2 = await RulehubClient.getIndex(url);
    expect(r1[0].id).toBe('t1');
    expect(r2[0].id).toBe('t2');
    expect((global as any).fetch).toHaveBeenCalledTimes(2);
  });

  it('normalizes optional passthrough fields', async () => {
    mockFetchOnce({
      body: {
        packages: [
          {
            id: 'opt',
            name: 'Optional',
            standard: 'S',
            version: '1',
            severity: 'high',
            framework: 'nist',
            paths: [{ path: 'a/b/c', exists: true }, { path: 'd/e' }, { bogus: true }],
            kyverno: [
              { path: 'policies/p.yaml' },
              { url: 'https://example.com/p2.yaml' },
              { nope: true },
            ],
            gatekeeper: [
              { path: 'gatekeeper/g.yaml' },
              { url: 'https://example.com/g2.yaml' },
              { x: 1 },
            ],
          },
        ],
      },
    });
    const out = await RulehubClient.getIndex('/opt');
    const item: any = out[0];
    expect(item.severity).toBe('high');
    expect(item.framework).toBe('nist');
    expect(Array.isArray(item.paths)).toBe(true);
    expect(item.paths[0]).toEqual({ path: 'a/b/c', exists: true });
    expect(item.paths[1]).toEqual({ path: 'd/e', exists: false });
    expect(item.kyverno).toEqual([
      { path: 'policies/p.yaml', url: undefined },
      { path: undefined, url: 'https://example.com/p2.yaml' },
    ]);
    expect(item.gatekeeper).toEqual([
      { path: 'gatekeeper/g.yaml', url: undefined },
      { path: undefined, url: 'https://example.com/g2.yaml' },
    ]);
  });
});
