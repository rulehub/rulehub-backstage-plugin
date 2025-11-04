import Ajv from 'ajv';
import schema from './plugin-index.schema.json';
import type { Pack } from './types';
import { ERROR_CODES, RulehubError } from './errors';

const ajv = new Ajv({ allErrors: true, strict: false });
const validateIndex = ajv.compile(schema as any);

/**
 * Lightweight client for fetching and validating RuleHub package indexes.
 * @public
 */
export class RulehubClient {
  private static _instance: RulehubClient;
  private cache: Map<string, { data: Pack[]; timestamp: number }> = new Map();
  private cacheTtlMs: number;

  constructor(ttlMs: number = 5 * 60 * 1000) {
    this.cacheTtlMs = ttlMs; // default 5 minutes
  }

  /**
   * Get the singleton instance of RulehubClient
   */
  /** @public */
  static get instance(): RulehubClient {
    if (!RulehubClient._instance) {
      RulehubClient._instance = new RulehubClient();
    }
    return RulehubClient._instance;
  }

  /**
   * Static method to fetch and validate the rulehub index (delegates to instance)
   * @param url The URL to fetch the index from
   * @param signal Optional AbortSignal for cancelling the request
   * @returns Promise<Pack[]> The normalized packages
   */
  /** @public */
  static async getIndex(url: string, signal?: AbortSignal): Promise<Pack[]> {
    return RulehubClient.instance.getIndex(url, signal);
  }

  /**
   * Fetches and validates the rulehub index from the given URL.
   * Handles legacy shape (items -> packages), schema validation with AJV,
   * and limits schema errors to the first 5.
   * @param url The URL to fetch the index from
   * @param signal Optional AbortSignal for cancelling the request
   * @returns Promise<Pack[]> The normalized packages
   * @throws RulehubError with specific error codes
   */
  /** @public */
  async getIndex(url: string, signal?: AbortSignal): Promise<Pack[]> {
    const now = Date.now();
    const cached = this.cache.get(url);
    if (cached && now - cached.timestamp < this.cacheTtlMs) {
      return cached.data;
    }

    try {
      const response = await fetch(url, { signal });

      if (!response.ok) {
        throw new RulehubError(
          ERROR_CODES.INDEX_HTTP_ERROR,
          `HTTP ${response.status}: ${response.statusText}`,
          `Failed to fetch index from ${url}`,
        );
      }

      const data = await response.json();

      // Handle legacy shape: items -> packages
      const rawContainer =
        Array.isArray(data?.packages) || Array.isArray(data?.items)
          ? data
          : { packages: undefined };
      const candidate = Array.isArray(rawContainer.packages)
        ? { packages: rawContainer.packages }
        : Array.isArray((rawContainer as any).items)
          ? { packages: (rawContainer as any).items }
          : undefined;

      if (!candidate) {
        throw new RulehubError(
          ERROR_CODES.INDEX_SCHEMA_INVALID,
          'Invalid index format: missing packages or items array',
          'Expected object with packages or items array',
        );
      }

      if (!validateIndex(candidate)) {
        const errors = validateIndex.errors || [];
        const limitedErrors = errors.slice(0, 5); // Limit to first 5 errors
        const errorMessages = limitedErrors
          .map((e) => `${e.instancePath || '/'} ${e.message}`)
          .join('; ');
        const details =
          errors.length > 5 ? `${errorMessages}; ...and ${errors.length - 5} more` : errorMessages;

        throw new RulehubError(
          ERROR_CODES.INDEX_SCHEMA_INVALID,
          `Schema validation failed: ${errorMessages}`,
          details,
        );
      }

      const rawPackages = candidate.packages;

      // Normalize entries: ensure required fields
      const normalized: Pack[] = rawPackages
        .filter((p: any) => p && typeof p === 'object')
        .map((p: any, i: number) => {
          const out: Pack = {
            id: p.id || p.name || `pkg-${i}`,
            name: p.name || p.id || `Package ${i}`,
            standard: p.standard || 'N/A',
            version: p.version || '0.0.0',
            jurisdiction: Array.isArray(p.jurisdiction)
              ? p.jurisdiction.filter(Boolean).map(String).join(', ')
              : p.jurisdiction,
            industry: Array.isArray((p as any).industry)
              ? (p as any).industry.filter(Boolean).map(String)
              : typeof (p as any).industry === 'string'
                ? (p as any).industry
                : undefined,
            coverage: Array.isArray(p.coverage) ? p.coverage : [],
            repoUrl: typeof p.repoUrl === 'string' ? p.repoUrl : undefined,
            repoPath: typeof p.repoPath === 'string' ? p.repoPath : undefined,
            kyvernoUrl: typeof p.kyvernoUrl === 'string' ? p.kyvernoUrl : undefined,
            kyvernoPath: typeof p.kyvernoPath === 'string' ? p.kyvernoPath : undefined,
            gatekeeperUrl: typeof p.gatekeeperUrl === 'string' ? p.gatekeeperUrl : undefined,
            gatekeeperPath: typeof p.gatekeeperPath === 'string' ? p.gatekeeperPath : undefined,
          } as Pack;
          // Optional passthroughs used by UI
          if (typeof p.severity === 'string') {
            (out as any).severity = p.severity;
          }
          if (typeof p.framework === 'string') {
            (out as any).framework = p.framework;
          }
          // Optional passthroughs used by UI (paths + engine arrays)
          if (Array.isArray(p.paths)) {
            (out as any).paths = p.paths
              .filter((x: any) => x && typeof x === 'object' && typeof x.path === 'string')
              .map((x: any) => ({ path: String(x.path), exists: Boolean(x.exists) }));
          }
          if (Array.isArray(p.kyverno)) {
            (out as any).kyverno = p.kyverno
              .filter((x: any) => x && typeof x === 'object' && (x.path || x.url))
              .map((x: any) => ({
                path: typeof x.path === 'string' ? x.path : undefined,
                url: typeof x.url === 'string' ? x.url : undefined,
              }));
          }
          if (Array.isArray(p.gatekeeper)) {
            (out as any).gatekeeper = p.gatekeeper
              .filter((x: any) => x && typeof x === 'object' && (x.path || x.url))
              .map((x: any) => ({
                path: typeof x.path === 'string' ? x.path : undefined,
                url: typeof x.url === 'string' ? x.url : undefined,
              }));
          }
          return out;
        });

      // Cache the result
      this.cache.set(url, { data: normalized, timestamp: now });

      return normalized;
    } catch (error) {
      if (signal?.aborted) {
        throw new RulehubError(
          ERROR_CODES.INDEX_ABORTED,
          'Request was aborted',
          'The fetch operation was cancelled',
        );
      }

      if (error instanceof RulehubError) {
        throw error;
      }

      // Handle network errors
      if (error instanceof TypeError && /fetch/i.test(String(error.message))) {
        throw new RulehubError(
          ERROR_CODES.INDEX_HTTP_ERROR,
          'Network error: fetch failed',
          String(error.message),
        );
      }

      // Handle abort errors
      if ((error as any).name === 'AbortError') {
        throw new RulehubError(
          ERROR_CODES.INDEX_ABORTED,
          'Request was aborted',
          'The fetch operation was cancelled',
        );
      }

      throw new RulehubError(
        ERROR_CODES.INDEX_UNKNOWN,
        `Unknown error: ${String((error as any)?.message || error)}`,
        String(error),
      );
    }
  }

  /**
   * Clear cache (for testing)
   */
  /** @public */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Set cache TTL (milliseconds). Useful for tests; default is 5 minutes.
   * Values less than or equal to 0 effectively disable caching.
   */
  /** @public */
  setCacheTTL(ttlMs: number): void {
    if (!Number.isFinite(ttlMs)) return;
    this.cacheTtlMs = Math.max(0, ttlMs);
  }
}
