// Public types for the plugin
// Re-exported from the package entrypoint for external consumers

/**
 * Descriptor of a RuleHub package exposed in the index.
 * @public
 */
export type Pack = {
  id: string;
  name: string;
  standard: string;
  version: string;
  jurisdiction?: string;
  industry?: string | string[];
  coverage?: string[];
  // Optional richer metadata (may be present if upstream index includes them)
  description?: string;
  framework?: 'kyverno' | 'gatekeeper' | 'other' | string;
  severity?: 'low' | 'medium' | 'high' | string;
  geo?: unknown;
  paths?: Array<{ path: string; exists: boolean }>;
  owner?: unknown;
  tags?: string[];
  links?: unknown;
  /** Optional full URL pointing to this pack in the repository (highest precedence) */
  repoUrl?: string;
  /** Optional repo-relative path (joined with repoBaseUrl) */
  repoPath?: string;
  /** Optional engine-specific links: Kyverno */
  kyvernoUrl?: string;
  kyvernoPath?: string;
  kyverno?: Array<{ path?: string; url?: string }>;
  /** Optional engine-specific links: Gatekeeper/OPA Rego */
  gatekeeperUrl?: string;
  gatekeeperPath?: string;
  gatekeeper?: Array<{ path?: string; url?: string }>;
};
