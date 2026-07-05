/**
 * @jorvel/types
 *
 * Zero-runtime shared type library for the JORVEL micro-frontend framework.
 *
 * Exports:
 * - App configuration types  (`JorvelAppConfig`, `AppType`)
 * - Federation config types  (`FederationConfig`, `SharedDependency`, `RemoteTarget`)
 * - Federation contract types (`FederationContract`, `defineFederationContract`,
 *                              `validateFederationContract`, `InferExposed`,
 *                              `InferEmits`, `InferListens`)
 * - Routing types            (`RouteTarget`, `RouteMatch`, `NavigateDetail`, `NavigateMode`)
 */

export type { AppType, JorvelAppConfig } from './app-config.js';

export type {
  SharedDependency,
  FederationConfig,
  RemoteTarget,
} from './federation-config.js';

export type {
  ExposesMap,
  EventContract,
  FederationContract,
  ContractViolation,
  InferExposed,
  InferEmits,
  InferListens,
} from './federation-contract.js';
export { defineFederationContract, validateFederationContract } from './federation-contract.js';

export type {
  RouteTarget,
  RouteMatch,
  NavigateMode,
  NavigateDetail,
} from './routing.js';

export type {
  JorvelWorkspaceConfig,
  JorvelRemoteConfig,
  JorvelOrchestratorConfig,
  JorvelFederationConfig,
  JorvelFeaturesConfig,
} from './jorvel-config.js';

export type { JorvelPlugin, JorvelDevPlan, JorvelAppMeta } from './plugins.js';

export type { JorvelPageRoute, JorvelRoutesManifest, JorvelHostRoutesManifest, JorvelRoutingCompiler } from './routing-compiler.js';
export { defaultRoutingCompiler, PAGE_EXTENSIONS, PAGE_EXT_RE } from './routing-compiler.js';

export {
  contractChecks,
  assertContract,
  generateContractTestSource,
  type Container,
  type ContractCheck,
  type ContractSuiteOptions,
  type GenerateOptions,
} from './contract-test.js';

export {
  matchRedirect,
  matchRewrite,
  type RedirectRule,
  type RewriteRule,
  type RedirectResult,
} from './redirects.js';

