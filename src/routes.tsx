import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from 'react';
import { Table, Progress, WarningPanel } from '@backstage/core-components';
import { createRouteRef, configApiRef, useApi } from '@backstage/core-plugin-api';

export const routeRef = createRouteRef({
  id: 'rulehub-root',
});
import type { Pack } from './types';
import { RulehubClient } from './RulehubClient';
import { RulehubError, ERROR_CODES } from './errors';
import { I18nProvider } from './i18n';
import { RulehubFooter } from './RulehubFooter';

// Defaults accept GitHub Pages index.json hosts and are normalized to GitHub tree bases for links.
const DEFAULT_REPO_BASE = 'https://rulehub.github.io/rulehub/plugin-index/index.json';
const DEFAULT_SOURCE_BASE = 'https://rulehub.github.io/rulehub-charts/plugin-index/index.json';

// Normalize bases that may be provided as GitHub Pages index.json URLs into GitHub tree bases
function normalizeToGitHubTreeBase(input: string, kind: 'repo' | 'source'): string {
  try {
    const href = new URL(input).href;
    // Pages URL: https://<owner>.github.io/<repo>/plugin-index/index.json
    const m = href.match(/^https?:\/\/([^/.]+)\.github\.io\/([^/]+)\/(.*)$/i);
    if (m) {
      const [, ownerRaw, repoRaw] = m;
      const owner = ownerRaw;
      const repo = repoRaw;
      // For repo links, prefer core repo when pages URL points to charts for known org
      if (kind === 'repo') {
        if (/charts/i.test(repo) && owner.toLowerCase() === 'rulehub') {
          return `https://github.com/${'rulehub'}/${'rulehub'}/tree/${'HEAD'}/`;
        }
        // Otherwise, map to this repo's tree
        return `https://github.com/${owner}/${repo}/tree/HEAD/`;
      }
      // For source links, prefer charts repo; if pages points to core, map to charts for known org
      if (kind === 'source') {
        if (/charts/i.test(repo)) {
          return `https://github.com/${owner}/${repo}/tree/HEAD/`;
        }
        if (owner.toLowerCase() === 'rulehub' && repo.toLowerCase() === 'rulehub') {
          return `https://github.com/${'rulehub'}/${'rulehub-charts'}/tree/${'HEAD'}/`;
        }
        // Fallback: map to the same repo's tree
        return `https://github.com/${owner}/${repo}/tree/HEAD/`;
      }
    }
  } catch {
    // ignore parse errors
  }
  return input;
}

export interface BaseProps {
  client?: RulehubClient;
}
export interface RulehubContentProps extends BaseProps {
  indexUrl: string;
  /** Optional base URL for repository links, e.g. https://github.com/rulehub/rulehub/tree/main/ */
  repoBaseUrl?: string;
  /** Optional explicit per-id mapping to repo paths or full URLs */
  repoPerId?: Record<string, string>;
  /** Optional base URL for Source (Kyverno/Gatekeeper) links, typically charts repo */
  sourceBaseUrl?: string;
  /** Optional: when no charts-relative path is available, allow falling back to absolute engine URL (core). Default false. */
  sourceAbsFallback?: boolean;
  /** Optional: seed initial rows (useful for fixture-driven tests or demos to bypass fetch entirely). */
  bootstrapRows?: Pack[];
  /** Optional: hard-disable any initial fetch regardless of bootstrapRows. Useful for smoke tests to guarantee no spinner. */
  disableInitialFetch?: boolean;
  /**
   * When true, hides the filters UI until initial data is loaded.
   * This makes component behavior more deterministic in fixture-driven tests that render immediately.
   * Default: false (filters render immediately as before).
   */
  hideFiltersWhileLoading?: boolean;
}
export interface RulehubPageProps extends BaseProps {
  indexUrl?: string;
  repoBaseUrl?: string;
  repoPerId?: Record<string, string>;
  sourceBaseUrl?: string;
}

// Internal error boundary to prevent the whole page from crashing if the Table
// implementation throws (e.g., due to unexpected row shape). We prefer to show a
// warning and a minimal fallback view instead of a blank screen in the demo.
class TableErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message?: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: undefined };
  }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown) {
    // Best-effort logging; in Backstage this goes to the browser console
    // and helps diagnose third-party table internals.
    globalThis.console?.error?.('[RuleHub] Table render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div data-testid="error-table">
          <WarningPanel title="Table render failed" severity="error">
            Failed to render table: {this.state.message}
          </WarningPanel>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

/**
 * Standalone RuleHub page component (may be used without router when embedded).
 * @public
 */
export const RulehubContent = (_props: RulehubContentProps): React.ReactElement | null => {
  const {
    client,
    indexUrl,
    repoBaseUrl,
    repoPerId,
    sourceBaseUrl,
    sourceAbsFallback,
    hideFiltersWhileLoading,
    bootstrapRows,
    disableInitialFetch,
  } = _props;
  // Initialize from bootstrapRows when provided to avoid relying on effect timing in test/demo harnesses
  const hasBootstrap = Array.isArray(bootstrapRows) && bootstrapRows.length > 0;
  const [rows, setRows] = useState<Pack[]>(() => (hasBootstrap ? (bootstrapRows as Pack[]) : []));
  const [loading, setLoading] = useState<boolean>(() => !hasBootstrap);
  const [error, setError] = useState<string | undefined>(undefined);
  const controllerRef = useRef<AbortController | null>(null);
  // Track mount state to avoid setting state after unmount and to ensure loading flag is cleared
  const mountedRef = useRef<boolean>(true);
  const hasClientProp = Boolean(client);
  const fetchCountRef = useRef<number>(0);
  const effectCountRef = useRef<number>(0);
  // Filters
  const [standardFilter, setStandardFilter] = useState<string>('');
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string>('');
  const [industryFilter, setIndustryFilter] = useState<string>('');

  // Use provided client or fallback to singleton
  const rulehubClient = useMemo(() => client || RulehubClient.instance, [client]);
  const url = indexUrl;

  // Display helpers (do not alter underlying filter values)
  const formatIndustryLabel = useCallback((val: string): string => {
    const raw = String(val || '').trim();
    if (!raw) return '';
    const map: Record<string, string> = {
      fintech: 'FinTech',
      medtech: 'MedTech',
      igaming: 'iGaming',
      edtech: 'EdTech',
      legaltech: 'LegalTech',
      gambling: 'Gambling',
      banking: 'Banking',
      payments: 'Payments',
      privacy: 'Privacy',
      platform: 'Platform',
    };
    const key = raw.toLowerCase();
    if (map[key]) return map[key];
    // Generic title case fallback (split on non-alphanum, capitalize first letter)
    return raw
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }, []);

  const fetchIndex = useCallback(async () => {
    // Abort any previous in-flight request before starting a new one
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(undefined);

    try {
      fetchCountRef.current += 1;
      const data = await rulehubClient.getIndex(url, controller.signal);
      // Defensively filter any non-object rows to avoid UI crashes if upstream data is malformed
      const safe = Array.isArray(data)
        ? (data.filter((r: any) => r && typeof r === 'object') as Pack[])
        : ([] as Pack[]);
      if (!controller.signal.aborted && mountedRef.current) setRows(safe);
    } catch (e) {
      // Ignore abort errors; don't update state after abort/unmount
      if (
        controller.signal.aborted ||
        (e instanceof RulehubError && e.code === ERROR_CODES.INDEX_ABORTED)
      )
        return;
      if (mountedRef.current) setRows([]);
      let msg = 'Unknown error';
      if (e instanceof RulehubError) {
        switch (e.code) {
          case ERROR_CODES.INDEX_HTTP_ERROR:
            msg = `HTTP error: ${e.message}`;
            break;
          case ERROR_CODES.INDEX_SCHEMA_INVALID:
            msg = `Schema invalid: ${e.message}`;
            break;
          case ERROR_CODES.INDEX_UNKNOWN:
            msg = `Unexpected error: ${e.message}`;
            break;
          default:
            msg = e.message;
        }
      } else {
        msg = e instanceof Error ? e.message : String(e);
      }
      if (mountedRef.current) setError(msg);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [url, rulehubClient]);

  useEffect(() => {
    effectCountRef.current += 1;
    // Ensure mounted flag is true for this effect run (important for React StrictMode/dev re-mounts)
    mountedRef.current = true;
    // initialize filters from query params (shareable links)
    try {
      const sp = new URL(window.location.href).searchParams;
      // Normalize common placeholder values like "All" to empty (no filter)
      const norm = (v: string | null) => {
        const s = (v ?? '').trim();
        return s.toLowerCase() === 'all' ? '' : s;
      };
      setStandardFilter(norm(sp.get('standard')));
      setJurisdictionFilter(norm(sp.get('jurisdiction')));
      setIndustryFilter(norm(sp.get('industry')));
      // coverage filter removed
    } catch {
      // ignore
    }
    // Some preview/test harnesses delay passive effects.
    // Only trigger fetch here if it hasn't been triggered yet AND we don't already
    // have bootstrap data. This prevents an unnecessary fetch that would flip the
    // loading spinner back on in deterministic tests even though rows are already seeded.
    // Intentionally do not add `rows.length` to deps to keep this initialization
    // effect stable and based on the initial render state.
    if (!disableInitialFetch && fetchCountRef.current === 0 && rows.length === 0) {
      fetchIndex();
    }
    return () => {
      // Cancel any ongoing request on unmount
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, [fetchIndex]);

  // Bootstrap data if provided (fixtures/demos) to avoid depending on effects timing in preview
  useEffect(() => {
    if (Array.isArray(bootstrapRows) && bootstrapRows.length > 0 && rows.length === 0) {
      setRows(bootstrapRows as Pack[]);
      setLoading(false);
    }
  }, [bootstrapRows, rows.length]);

  // Ensure initial fetch runs even if passive effects are delayed or suppressed (e.g., in certain
  // preview harness flows). Guard with fetchCount to avoid duplicate requests.
  useLayoutEffect(() => {
    // If bootstrap data is provided, do not perform an initial fetch at all.
    // Rows are already seeded from the useState initializer, so we can skip any
    // follow-up fetch that would otherwise flip loading to true and cause preview flicker.
    if (disableInitialFetch) return;
    if (Array.isArray(bootstrapRows) && bootstrapRows.length > 0) return;

    // Seed bootstrap rows immediately on mount to avoid depending on passive effects timing
    // (kept for defensive behavior if initial rows were empty for some reason)
    if (Array.isArray(bootstrapRows) && bootstrapRows.length > 0 && rows.length === 0) {
      startTransition(() => {
        setRows(bootstrapRows as Pack[]);
        setLoading(false);
      });
      return; // Skip fetching when bootstrap data is provided
    }
    if (!disableInitialFetch && fetchCountRef.current === 0) {
      // Mark fetch-driven state updates as a transition to avoid React 18
      // "suspended while responding to synchronous input" warnings in dev
      startTransition(() => {
        fetchIndex();
      });
    }
  }, [bootstrapRows, rows.length, fetchIndex]);

  // No data normalization: display upstream values as-is.

  // Final defensive sanitize
  const tableData: Pack[] = Array.isArray(rows)
    ? rows
        .filter((r: any) => r && typeof r === 'object')
        .map((p: any, i: number) => {
          const rawId = String(p.id ?? p.name ?? `pkg-${i}`);
          const rawName = String(p.name ?? p.id ?? `Package ${i}`);
          // Do not synthesize a version; show empty when upstream omits it
          const v = (p as any)?.version;
          const rawVersion = typeof v === 'number' ? String(v) : typeof v === 'string' ? v : '';
          // Jurisdiction: show only upstream string value if provided
          const explicitJurisdiction =
            typeof p.jurisdiction === 'string' ? p.jurisdiction : undefined;
          return {
            id: rawId,
            name: rawName,
            standard: typeof p.standard === 'string' ? p.standard : '',
            version: rawVersion,
            jurisdiction: explicitJurisdiction,
            // Preserve industry as provided upstream (string or array)
            industry: Array.isArray((p as any).industry)
              ? (p as any).industry.filter(Boolean).map(String)
              : typeof (p as any).industry === 'string'
                ? (p as any).industry
                : undefined,
            // Coverage column removed from UI; keep data internal but not displayed
            coverage: Array.isArray(p.coverage) ? p.coverage.map((x: any) => String(x)) : [],
            // Optional richer fields (passed through as-is when present)
            description: typeof p.description === 'string' ? p.description : undefined,
            framework: typeof p.framework === 'string' ? p.framework : undefined,
            severity: typeof p.severity === 'string' ? p.severity : undefined,
            paths: Array.isArray(p.paths)
              ? p.paths
                  .filter((x: any) => x && typeof x === 'object' && typeof x.path === 'string')
                  .map((x: any) => ({ path: String(x.path), exists: Boolean(x.exists) }))
              : undefined,
            repoUrl: typeof p.repoUrl === 'string' ? p.repoUrl : undefined,
            repoPath: typeof p.repoPath === 'string' ? p.repoPath : undefined,
            kyvernoUrl: typeof p.kyvernoUrl === 'string' ? p.kyvernoUrl : undefined,
            kyvernoPath: typeof p.kyvernoPath === 'string' ? p.kyvernoPath : undefined,
            gatekeeperUrl: typeof p.gatekeeperUrl === 'string' ? p.gatekeeperUrl : undefined,
            gatekeeperPath: typeof p.gatekeeperPath === 'string' ? p.gatekeeperPath : undefined,
            kyverno: Array.isArray((p as any).kyverno)
              ? ((p as any).kyverno as any[])
                  .filter((x) => x && typeof x === 'object' && (x.path || x.url))
                  .map((x) => ({
                    path: typeof x.path === 'string' ? x.path : undefined,
                    url: typeof x.url === 'string' ? x.url : undefined,
                  }))
              : undefined,
            gatekeeper: Array.isArray((p as any).gatekeeper)
              ? ((p as any).gatekeeper as any[])
                  .filter((x) => x && typeof x === 'object' && (x.path || x.url))
                  .map((x) => ({
                    path: typeof x.path === 'string' ? x.path : undefined,
                    url: typeof x.url === 'string' ? x.url : undefined,
                  }))
              : undefined,
          } as Pack;
        })
    : [];

  // Distinct options for filters
  const standards = useMemo(
    () => Array.from(new Set(tableData.map((r) => r.standard).filter(Boolean))).sort(),
    [tableData],
  );
  const jurisdictions = useMemo(
    () => Array.from(new Set(tableData.map((r) => r.jurisdiction || '').filter(Boolean))).sort(),
    [tableData],
  );
  const industries = useMemo(() => {
    const vals: string[] = [];
    for (const r of tableData) {
      const ind = (r as any).industry;
      if (Array.isArray(ind)) vals.push(...ind.filter(Boolean).map(String));
      else if (typeof ind === 'string' && ind.trim()) vals.push(ind.trim());
    }
    return Array.from(new Set(vals)).sort();
  }, [tableData]);

  // Apply filters
  const filteredData = useMemo(() => {
    let out = tableData;
    if (standardFilter) out = out.filter((r) => r.standard === standardFilter);
    if (jurisdictionFilter) out = out.filter((r) => (r.jurisdiction || '') === jurisdictionFilter);
    if (industryFilter)
      out = out.filter((r) => {
        const ind = (r as any).industry;
        if (Array.isArray(ind)) return ind.includes(industryFilter);
        if (typeof ind === 'string') return ind === industryFilter;
        return false;
      });
    return out;
  }, [tableData, standardFilter, jurisdictionFilter, industryFilter]);

  // Sync filters to query params (replaceState to avoid history spam)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const sp = url.searchParams;
      const set = (k: string, v: string) => {
        if (v) sp.set(k, v);
        else sp.delete(k);
      };
      set('standard', standardFilter);
      set('jurisdiction', jurisdictionFilter);
      set('industry', industryFilter);
      window.history.replaceState({}, '', `${url.pathname}?${sp.toString()}`);
    } catch {
      // ignore
    }
  }, [standardFilter, jurisdictionFilter, industryFilter]);

  // Debug toggle for internal link base display
  const showDebug = useMemo(() => {
    const env = ((globalThis as any).process?.env?.RULEHUB_DEBUG as string | undefined) ?? '';
    let q = '';
    try {
      q = new URL(window.location.href).searchParams.get('debug') ?? '';
    } catch {
      // ignore
    }
    const on = (s: string) => s === '1' || s.toLowerCase?.() === 'true';
    return on(env) || on(q);
  }, []);

  // Build repo link from id/row (best-effort): prefer row.repoUrl/row.repoPath, then per-id mapping, then heuristic <prefix>.<suffix>
  const effectiveRepoBase = useMemo(() => {
    const raw = (repoBaseUrl || DEFAULT_REPO_BASE).trim();
    const base = normalizeToGitHubTreeBase(raw, 'repo');
    return base.endsWith('/') ? base : `${base}/`;
  }, [repoBaseUrl]);

  const effectiveSourceBase = useMemo(() => {
    const raw = (sourceBaseUrl || DEFAULT_SOURCE_BASE).trim();
    const chosen = normalizeToGitHubTreeBase(raw, 'source');
    return chosen.endsWith('/') ? chosen : `${chosen}/`;
  }, [sourceBaseUrl]);

  const buildRepoUrl = useCallback(
    (id: string, row?: Partial<Pack>): string | null => {
      const normalizedBase = effectiveRepoBase;

      // 0) Row-provided explicit URL/path (if index includes it)
      if (row && typeof row.repoUrl === 'string' && /^https?:\/\//i.test(row.repoUrl)) {
        return row.repoUrl;
      }
      if (row && typeof row.repoPath === 'string' && row.repoPath) {
        const rp = row.repoPath.replace(/^\/+/, '');
        // If the provided repoPath points to the charts tree (e.g., files/kyverno or files/gatekeeper),
        // ignore it for repo links — we want ID/Name to point to the core repo instead.
        // This allows using the charts index while still linking to core sources for the repository view.
        if (!/^files\//.test(rp)) {
          return `${normalizedBase}${rp}`;
        }
        // fall through to per-id mapping / heuristic
      }
      // 1) Explicit per-id mapping has top priority
      const explicit = repoPerId && repoPerId[id];
      if (explicit) {
        const v = String(explicit);
        if (/^https?:\/\//i.test(v)) return v; // full URL
        return `${normalizedBase}${v.replace(/^\/+/, '')}`;
      }
      // 2) Heuristic: <prefix>.<suffix> => policies/<prefix>/<suffix>
      const parts = String(id).split('.');
      if (parts.length === 2) {
        const [prefix, rest] = parts;
        if (prefix && rest) {
          const path = `policies/${prefix}/${rest}`;
          return `${normalizedBase}${path}`;
        }
      }
      // 3) No link if not mappable (avoid generic search per user request)
      return null;
    },
    [effectiveRepoBase, repoPerId],
  );

  // Build a link from engine-specific fields
  const buildEngineUrl = useCallback(
    (row: Partial<Pack>, kind: 'kyverno' | 'gatekeeper'): string | null => {
      const normalizedBase = effectiveSourceBase;
      const urlField = kind === 'kyverno' ? (row as any).kyvernoUrl : (row as any).gatekeeperUrl;
      const pathField = kind === 'kyverno' ? (row as any).kyvernoPath : (row as any).gatekeeperPath;
      const isChartsRelative = (rel: string) =>
        /^(files\/(kyverno|gatekeeper|gatekeeper-templates)\/)$/i.test(
          // Fast prefix check without full path semantics
          rel.replace(/^\/+/, '').slice(0, 30).toLowerCase(),
        ) || /^(files\/(kyverno|gatekeeper|gatekeeper-templates)\/)/i.test(rel.replace(/^\/+/, ''));
      const looksCorePolicies = (rel: string) => {
        const s = rel.toLowerCase();
        return s.startsWith('policies/') || s.includes('/policies/') || s.endsWith('policy.rego');
      };
      const baseLooksCharts =
        /rulehub-charts/i.test(normalizedBase) || /\/files\//i.test(normalizedBase);

      // 1) If an explicit engine path is provided, prefer building from source base
      if (typeof pathField === 'string' && pathField) {
        const rel = pathField.replace(/^\/+/, '');
        // If the explicit path looks like a core repo path (policies/... or *.rego)
        // and our source base points to charts, ignore it and try better options below.
        if (baseLooksCharts && looksCorePolicies(rel) && !isChartsRelative(rel)) {
          // fall through to arrays / generic heuristics
        } else {
          return `${normalizedBase}${rel}`;
        }
      }

      // 2) Prefer engine arrays; when both url and path are present, prefer path to honor source base
      const arr = (kind === 'kyverno' ? (row as any).kyverno : (row as any).gatekeeper) as
        | Array<{ path?: string; url?: string }>
        | undefined;
      if (Array.isArray(arr) && arr.length > 0) {
        // Prefer relative paths from arrays (honors source base)
        let hasChartsRel = false;
        let hasAbsUrl = false;
        let onlyCoreStylePaths = true;
        for (const it of arr) {
          if (it && typeof it.path === 'string' && it.path) {
            const rel = it.path.replace(/^\/+/, '');
            const coreLike = looksCorePolicies(rel) && !isChartsRelative(rel);
            if (!coreLike) onlyCoreStylePaths = false;
            if (!hasChartsRel && isChartsRelative(rel)) hasChartsRel = true;
            if (!coreLike) {
              // First non-core-like relative path can be returned immediately
              return `${normalizedBase}${rel}`;
            }
          }
        }
        for (const it of arr) {
          if (it && typeof it.url === 'string' && /^https?:\/\//i.test(it.url)) {
            hasAbsUrl = true;
            break;
          }
        }
        // If configured, and we have only core-style paths (no charts-relative) but do have absolute URLs,
        // prefer returning the absolute URL immediately to avoid a likely broken charts link.
        if (sourceAbsFallback && !hasChartsRel && onlyCoreStylePaths && hasAbsUrl) {
          for (const it of arr) {
            if (it && typeof it.url === 'string' && /^https?:\/\//i.test(it.url)) return it.url;
          }
        }
        // Otherwise continue with engine detection and ID-based derivation.
      }

      // 3) Use generic file paths to detect which engine applies
      let canKyverno = false;
      let canGatekeeper = false;
      const paths = Array.isArray(row.paths) ? row.paths : [];
      for (const entry of paths) {
        const rel = (entry as any)?.path as string | undefined;
        if (!rel || typeof rel !== 'string') continue;
        const s = rel.toLowerCase();
        if (s.includes('/kyverno/') || s.startsWith('addons/kyverno')) canKyverno = true;
        if (
          s.includes('k8s-gatekeeper') ||
          s.endsWith('policy.rego') ||
          s.includes('/templates/') ||
          s.includes('/constraints/')
        )
          canGatekeeper = true;
      }

      // 4) Best-effort heuristic from ID -> charts filename pattern, but only for the detected engine
      if (typeof row.id === 'string') {
        // a) Common two-part ID: <domain>.<name>
        const m2 = row.id.match(/^([a-z0-9_-]+)\.([a-z0-9_-]+)$/i);
        if (m2) {
          const domain = m2[1];
          const name = m2[2];
          if ((kind === 'kyverno' && canKyverno) || (kind === 'gatekeeper' && canGatekeeper)) {
            const rel =
              kind === 'kyverno'
                ? `files/kyverno/${domain}-${name}-policy.yaml`
                : `files/gatekeeper/${domain}-${name}-constraint.yaml`;
            return `${normalizedBase}${rel}`;
          }
        }
        // b) Gatekeeper templates occasionally use three-part IDs ending with .template
        //    Example: ban.hostnetwork.template -> files/gatekeeper-templates/ban-hostnetwork-template.yaml
        //    For explicit .template pattern we can safely infer Gatekeeper even if engine detection is absent.
        const m3 = row.id.match(/^([a-z0-9_-]+)\.([a-z0-9_-]+)\.template$/i);
        if (m3 && kind === 'gatekeeper') {
          const domain = m3[1];
          const name = m3[2];
          const rel = `files/gatekeeper-templates/${domain}-${name}-template.yaml`;
          return `${normalizedBase}${rel}`;
        }

        // c) Gatekeeper constraint placeholder patterns
        //    betting.constraint.placeholder           -> files/gatekeeper/betting-constraint.yaml
        //    betting.constraint.template.placeholder  -> files/gatekeeper-templates/betting-constraint-template.yaml
        //    These placeholders are intentionally not Kyverno and can be inferred without engine detection.
        const mConstraintTemplate = row.id.match(
          /^([a-z0-9_-]+)\.constraint\.template(?:\.placeholder)?$/i,
        );
        if (mConstraintTemplate && kind === 'gatekeeper') {
          const domain = mConstraintTemplate[1];
          const rel = `files/gatekeeper-templates/${domain}-constraint-template.yaml`;
          return `${normalizedBase}${rel}`;
        }
        const mConstraint = row.id.match(/^([a-z0-9_-]+)\.constraint(?:\.placeholder)?$/i);
        if (mConstraint && kind === 'gatekeeper') {
          const domain = mConstraint[1];
          const rel = `files/gatekeeper/${domain}-constraint.yaml`;
          return `${normalizedBase}${rel}`;
        }
      }

      // 5) If engine arrays included only absolute URLs, consider them now as a fallback
      if (Array.isArray(arr) && arr.length > 0) {
        for (const it of arr) {
          if (it && typeof it.url === 'string' && /^https?:\/\//i.test(it.url)) return it.url;
        }
      }

      // 6) Fall back to explicit absolute URL if present
      if (typeof urlField === 'string' && /^https?:\/\//i.test(urlField)) return urlField;

      return null;
    },
    [effectiveSourceBase],
  );

  // Force Table to remount when the underlying dataset identity changes to avoid
  // any stale internal row references inside the Table implementation
  // (compute without hooks to preserve hook order)
  const tableKey = `rulehub-${tableData.length}-${tableData[0]?.id ?? ''}`;

  return (
    <I18nProvider>
      <>
        {loading && (
          <div data-testid="loading">
            <Progress />
          </div>
        )}
        {!loading && error && (
          <div data-testid="error">
            <WarningPanel title="Failed to load index" severity="error">
              Failed to load index: {error}
              <div style={{ marginTop: 12 }}>
                <button type="button" onClick={fetchIndex} style={{ padding: '6px 12px' }}>
                  Retry
                </button>
              </div>
            </WarningPanel>
          </div>
        )}
        {/* Filters */}
        {(!hideFiltersWhileLoading || !loading) && (
          <div
            data-testid="filters"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 12,
              alignItems: 'center',
            }}
          >
            <label>
              <span style={{ margin: 6 }}>Standard</span>
              <select
                aria-label="Standard filter"
                value={standardFilter}
                onChange={(e) => setStandardFilter(e.target.value)}
              >
                <option value="">All</option>
                {standards.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span style={{ margin: 6 }}>Jurisdiction</span>
              <select
                aria-label="Jurisdiction filter"
                value={jurisdictionFilter}
                onChange={(e) => setJurisdictionFilter(e.target.value)}
              >
                <option value="">All</option>
                {jurisdictions.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span style={{ margin: 6 }}>Industry</span>
              <select
                aria-label="Industry filter"
                value={industryFilter}
                onChange={(e) => setIndustryFilter(e.target.value)}
              >
                <option value="">All</option>
                {industries.map((v) => (
                  <option key={v} value={v}>
                    {formatIndustryLabel(v)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                setStandardFilter('');
                setJurisdictionFilter('');
                setIndustryFilter('');
              }}
              style={{
                background: 'transparent',
                border: '1px solid #e5e7eb',
                borderRadius: 4,
                color: '#1f6feb',
                cursor: 'pointer',
                padding: '6px 8px',
              }}
              aria-label="Reset"
            >
              Reset
            </button>
          </div>
        )}
        {/* Show the effective repository base for link resolution to aid debugging/verification */}
        {showDebug && (
          <div style={{ marginBottom: 8, fontSize: 12, color: '#9ca3af' }}>
            <div data-testid="index-url">
              Index URL:{' '}
              <a
                href={url}
                title="Open index.json"
                aria-label="Open index.json"
                target="_blank"
                rel="noreferrer"
              >
                {url}
              </a>
            </div>
            <div data-testid="client-provided">
              Client: {hasClientProp ? 'provided' : 'singleton'}
            </div>
            <div data-testid="effect-count">Effects: {effectCountRef.current}</div>
            {/* Show raw (input) bases as provided via props/controls for clarity */}
            <div data-testid="repo-base-raw">Repo base (raw): {repoBaseUrl || '<default>'}</div>
            <div data-testid="source-base-raw">
              Source base (raw): {sourceBaseUrl || '<default>'}
            </div>
            <div data-testid="repo-base">
              Repo base (effective, normalized):{' '}
              <a
                href={effectiveRepoBase}
                title="Open repo base"
                aria-label="Open repo base"
                target="_blank"
                rel="noreferrer"
              >
                {effectiveRepoBase}
              </a>
            </div>
            <div data-testid="source-base" style={{ marginTop: 2 }}>
              Source base (effective, normalized):{' '}
              <a
                href={effectiveSourceBase}
                title="Open source base"
                aria-label="Open source base"
                target="_blank"
                rel="noreferrer"
              >
                {effectiveSourceBase}
              </a>
            </div>
            <div data-testid="debug-state" style={{ marginTop: 4 }}>
              Debug state: loading={String(loading)}, error={String(Boolean(error))}, rows=
              {rows.length}, tableData={tableData.length}, filtered={filteredData.length}, fetches=
              {fetchCountRef.current}
            </div>
          </div>
        )}
        {!loading && !error && tableData.length === 0 && (
          <div data-testid="empty-state" style={{ marginBottom: 16 }}>
            No packages found in index.
          </div>
        )}
        {!loading && !error && (
          <TableErrorBoundary>
            <Table
              key={tableKey}
              title="RuleHub"
              options={{ paging: true, search: true }}
              columns={[
                {
                  title: 'Name',
                  field: 'name',
                  defaultSort: 'asc',
                  render: (row?: Partial<Pack>) => {
                    const id = String(row?.id ?? '');
                    const name = String(row?.name ?? '');
                    const href = id ? buildRepoUrl(id, row) : null;
                    if (href) {
                      return (
                        <a
                          href={href}
                          title={`Open ${name} in repository`}
                          aria-label={`Open ${name}`}
                          target="_blank"
                          rel="noreferrer"
                          data-testid="link"
                          data-href={href}
                        >
                          {name}
                        </a>
                      );
                    }
                    return name;
                  },
                },
                {
                  title: 'ID',
                  field: 'id',
                  render: (row?: Partial<Pack>) => {
                    const id = String(row?.id ?? '');
                    const href = id ? buildRepoUrl(id, row) : null;
                    if (href) {
                      return (
                        <a
                          href={href}
                          title={`Open ${id} in repository`}
                          aria-label={`Open ${id}`}
                          target="_blank"
                          rel="noreferrer"
                          data-testid="link"
                          data-href={href}
                        >
                          {id}
                        </a>
                      );
                    }
                    return id;
                  },
                },
                { title: 'Standard', field: 'standard' },
                { title: 'Version', field: 'version' },
                {
                  title: 'Jurisdiction',
                  field: 'jurisdiction',
                  render: (row?: Partial<Pack>) => {
                    const j = (row as any)?.jurisdiction;
                    return j && String(j).trim() ? String(j) : '—';
                  },
                },
                {
                  title: 'Industry',
                  field: 'industry',
                  customSort: (a: any, b: any) => {
                    const toText = (v: any) =>
                      Array.isArray(v)
                        ? v.filter(Boolean).map(String).join(', ').toLowerCase()
                        : typeof v === 'string'
                          ? v.toLowerCase()
                          : '';
                    return toText((a as any).industry).localeCompare(toText((b as any).industry));
                  },
                  customFilterAndSearch: (term: string, rowData: any) => {
                    const ind = rowData?.industry;
                    const text = Array.isArray(ind)
                      ? ind.filter(Boolean).map(String).join(', ')
                      : typeof ind === 'string'
                        ? ind
                        : '';
                    return text.toLowerCase().includes(String(term || '').toLowerCase());
                  },
                  render: (row?: Partial<Pack>) => {
                    const ind = (row as any)?.industry;
                    if (Array.isArray(ind))
                      return ind.map((s: any) => formatIndustryLabel(String(s))).join(', ');
                    if (typeof ind === 'string') return formatIndustryLabel(ind);
                    return '';
                  },
                },
                {
                  title: 'Severity',
                  field: 'severity',
                  render: (row?: Partial<Pack>) => {
                    const raw = String(row?.severity ?? '').trim();
                    if (!raw) return null;
                    const sev = raw.toLowerCase();
                    const styleMap: Record<string, { bg: string; border: string; color: string }> =
                      {
                        low: { bg: '#dcfce7', border: '#86efac', color: '#065f46' },
                        medium: { bg: '#fef9c3', border: '#fde68a', color: '#92400e' },
                        high: { bg: '#ffedd5', border: '#fdba74', color: '#9a3412' },
                        critical: { bg: '#fee2e2', border: '#fca5a5', color: '#991b1b' },
                      };
                    const s = styleMap[sev] ?? {
                      bg: '#e5e7eb',
                      border: '#d1d5db',
                      color: '#374151',
                    };
                    return (
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 8,
                          border: `1px solid ${s.border}`,
                          background: s.bg,
                          color: s.color,
                          fontSize: 12,
                          lineHeight: '18px',
                          textTransform: 'capitalize',
                        }}
                        data-testid="severity-badge"
                        title={`Severity: ${raw}`}
                      >
                        {sev}
                      </span>
                    );
                  },
                },
                {
                  title: 'Charts Source',
                  sorting: false,
                  searchable: false,
                  render: (row?: Partial<Pack>) => {
                    const kUrl = row ? buildEngineUrl(row, 'kyverno') : null;
                    const gUrl = row ? buildEngineUrl(row, 'gatekeeper') : null;
                    if (!kUrl && !gUrl) {
                      return (
                        <span
                          data-testid="source-fallback"
                          title="Not translatable to Kubernetes policy"
                          aria-label="Non-K8s policy"
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 8,
                            border: '1px solid #d1d5db',
                            background: '#f3f4f6',
                            color: '#374151',
                            fontSize: 12,
                            lineHeight: '18px',
                          }}
                        >
                          Non‑K8s
                        </span>
                      );
                    }
                    const muted = { color: '#9ca3af' } as const;
                    return (
                      <div
                        style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                        data-testid="source-links"
                      >
                        <div>
                          {kUrl ? (
                            <a
                              href={kUrl}
                              title="Open Kyverno"
                              aria-label="Open Kyverno"
                              target="_blank"
                              rel="noreferrer"
                              data-testid="link"
                              data-href={kUrl}
                            >
                              Kyverno
                            </a>
                          ) : (
                            <span style={muted}>Kyverno</span>
                          )}
                        </div>
                        <div>
                          {gUrl ? (
                            <a
                              href={gUrl}
                              title="Open Gatekeeper"
                              aria-label="Open Gatekeeper"
                              target="_blank"
                              rel="noreferrer"
                              data-testid="link"
                              data-href={gUrl}
                            >
                              Gatekeeper
                            </a>
                          ) : (
                            <span style={muted}>Gatekeeper</span>
                          )}
                        </div>
                      </div>
                    );
                  },
                },
              ]}
              data={filteredData as any}
            />
          </TableErrorBoundary>
        )}
        {!loading && !error && <RulehubFooter />}
      </>
    </I18nProvider>
  );
};

/**
 * RulehubPage reads config from Backstage config API and renders content.
 * @public
 */
export const RulehubPage = (_props: any = {}): React.ReactElement | null => {
  const {
    client,
    indexUrl: indexOverride,
    repoBaseUrl: repoBaseOverride,
    repoPerId: repoPerIdOverride,
    sourceBaseUrl: sourceBaseOverride,
  } = _props as RulehubPageProps;
  const configApi = useApi(configApiRef);
  // Allow URL overrides to avoid configApi usage in demo/frontend-only mode
  let queryIndexUrl: string | undefined;
  let queryRepoBaseUrl: string | undefined;
  let queryPerIdJson: string | undefined;
  let querySourceBaseUrl: string | undefined;
  let querySourceAbsFallback: string | undefined;
  try {
    const sp = new URL(window.location.href).searchParams;
    queryIndexUrl = sp.get('index') ?? undefined;
    queryRepoBaseUrl = sp.get('repoBase') ?? undefined;
    querySourceBaseUrl = sp.get('sourceBase') ?? undefined;
    querySourceAbsFallback = sp.get('sourceAbsFallback') ?? undefined;
    queryPerIdJson = sp.get('perIdJson') ?? undefined;
  } catch {
    // ignore
  }
  // Read config defensively: in frontend-only demo or when schema isn’t aggregated yet,
  // configApi may throw visibility errors. Default to safe values.
  // Default to the official hosted index to provide rich demo data out of the box
  let indexUrl =
    indexOverride ??
    queryIndexUrl ??
    'https://rulehub.github.io/rulehub-charts/plugin-index/index.json';
  if (!indexOverride && !queryIndexUrl) {
    try {
      const v = configApi.getOptionalString('rulehub.indexUrl');
      if (v) indexUrl = v;
    } catch {
      // fall back to default
    }
  }
  // Optional environment override for demo/dev runs
  const envRepoBaseUrl =
    ((globalThis as any).process?.env?.RULEHUB_REPO_BASE_URL as string | undefined) ?? undefined;
  let repoBaseUrl = repoBaseOverride ?? queryRepoBaseUrl ?? envRepoBaseUrl ?? DEFAULT_REPO_BASE;
  if (!repoBaseOverride && !queryRepoBaseUrl) {
    try {
      const v = configApi.getOptionalString('rulehub.links.repoBaseUrl');
      if (v) repoBaseUrl = v;
    } catch {
      // fall back to default
    }
  }

  // Separate base for Source (charts) links
  const envSourceBaseUrl =
    ((globalThis as any).process?.env?.RULEHUB_SOURCE_BASE_URL as string | undefined) ?? undefined;
  let sourceBaseUrl = sourceBaseOverride ?? querySourceBaseUrl ?? envSourceBaseUrl;
  // Optional: allow fallback to absolute engine URLs (core) when charts path is not available/derivable
  const envSourceAbsFallback =
    ((globalThis as any).process?.env?.RULEHUB_SOURCE_ABS_FALLBACK as string | undefined) ??
    undefined;
  const sourceAbsFallback = (() => {
    const pick = (v?: string) => (v && (v === '1' || v.toLowerCase() === 'true')) || false;
    if (typeof (_props as any)?.sourceAbsFallback === 'boolean')
      return Boolean((_props as any).sourceAbsFallback);
    if (querySourceAbsFallback) return pick(querySourceAbsFallback);
    if (envSourceAbsFallback) return pick(envSourceAbsFallback);
    // default disabled to preserve strict charts-first behavior
    return false;
  })();
  if (!sourceBaseOverride && !querySourceBaseUrl && !envSourceBaseUrl) {
    try {
      const v = configApi.getOptionalString('rulehub.links.sourceBaseUrl');
      if (v) sourceBaseUrl = v;
    } catch {
      // ignore
    }
  }
  let repoPerId: Record<string, string> | undefined = repoPerIdOverride;
  let perIdJson: string | undefined;
  perIdJson = queryPerIdJson;
  if (!perIdJson) {
    try {
      perIdJson = configApi.getOptionalString('rulehub.links.perIdJson') ?? undefined;
    } catch {
      perIdJson = undefined;
    }
  }
  // Auto-detect charts repo base when consuming index.json from a charts repo and
  // sourceBaseUrl is not explicitly provided. This keeps Name/ID pointing to the
  // core repo while Source links (Kyverno/Gatekeeper) go to the charts repo by default.
  if (!sourceBaseUrl) {
    const inferSourceBaseFromIndex = (u: string): string | undefined => {
      try {
        const href = new URL(u).href;
        // jsDelivr: https://cdn.jsdelivr.net/gh/<owner>/<repo>@<ref>/.../plugin-index/index.json
        {
          const m = href.match(
            /^https?:\/\/cdn\.jsdelivr\.net\/gh\/([^/]+)\/([^/@]+)@([^/]+)\/(.*)$/i,
          );
          if (m) {
            const [, owner, repo, ref] = m;
            if (/charts/i.test(repo) || /plugin-index/i.test(href)) {
              return `https://github.com/${owner}/${repo}/tree/${ref}/`;
            }
          }
        }
        // raw.githubusercontent.com: https://raw.githubusercontent.com/<owner>/<repo>/<ref>/.../plugin-index/index.json
        {
          const m = href.match(
            /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.*)$/i,
          );
          if (m) {
            const [, owner, repo, ref] = m;
            if (/charts/i.test(repo) || /plugin-index/i.test(href)) {
              return `https://github.com/${owner}/${repo}/tree/${ref}/`;
            }
          }
        }
        // GitHub Pages: https://<owner>.github.io/<repo>/plugin-index/index.json
        {
          const m = href.match(/^https?:\/\/([^/.]+)\.github\.io\/([^/]+)\/(.*)$/i);
          if (m) {
            const [, owner, repo] = m;
            // If pages are served from a charts repo, map directly
            if (/charts/i.test(repo)) {
              // Ref is unknown on pages; default to HEAD to follow default branch
              return `https://github.com/${owner}/${repo}/tree/HEAD/`;
            }
            // Special-case: official RuleHub pages host index from the core repo (rulehub),
            // but Source links should point to the charts repo by default.
            if (owner.toLowerCase() === 'rulehub' && repo.toLowerCase() === 'rulehub') {
              const org = 'rulehub';
              const charts = 'rulehub-charts';
              const ref = 'HEAD';
              return `https://github.com/${org}/${charts}/tree/${ref}/`;
            }
          }
        }
        // Fallback: if URL explicitly mentions rulehub-charts, default to upstream charts repo
        if (href.includes('rulehub-charts')) {
          const m = href.match(/rulehub-charts@([^/]+)/);
          const ref = m?.[1] ?? 'HEAD';
          return `https://github.com/rulehub/rulehub-charts/tree/${ref}/`;
        }
      } catch {
        // ignore parse errors
      }
      return undefined;
    };
    const inferred = inferSourceBaseFromIndex(indexUrl);
    if (inferred) sourceBaseUrl = inferred;
    // If inference failed, default to charts repo main to honor requirement
    if (!inferred) sourceBaseUrl = DEFAULT_SOURCE_BASE;
  }
  if (perIdJson) {
    try {
      const parsed = JSON.parse(perIdJson);
      if (parsed && typeof parsed === 'object') repoPerId = parsed as Record<string, string>;
    } catch {
      // ignore invalid JSON; fallback to undefined
      globalThis.console?.warn?.('[RuleHub] Invalid rulehub.links.perIdJson, ignoring');
    }
  } else if (typeof (configApi as any).getOptional === 'function') {
    try {
      const raw = (configApi as any).getOptional('rulehub.links.perId');
      if (raw && typeof raw === 'object') repoPerId = raw as Record<string, string>;
    } catch {
      // ignore
    }
  }
  return (
    <RulehubContent
      client={client}
      indexUrl={indexUrl}
      repoBaseUrl={repoBaseUrl}
      repoPerId={repoPerId}
      sourceBaseUrl={sourceBaseUrl}
      sourceAbsFallback={sourceAbsFallback}
    />
  );
};
