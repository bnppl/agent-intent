/** Shared wire contracts. Incoming requests are validated at runtime as well. */
export interface Revision { head: string; tree: string }
export interface Config {
  version: 1;
  feature_roots: string[];
  glue_roots: string[];
  control_paths: string[];
}
export interface Scenario {
  id: string; path: string; line: number; name: string; keyword: string;
  intent: boolean; directIntent: boolean; inheritedIntent: boolean;
  tags: string[]; sourceHash: string; source: string;
  tagLocations: { line: number; column: number }[];
}
export interface ProtectedChange {
  path: string; category: 'specification' | 'glue/support' | 'verification controls';
  change: 'added' | 'deleted' | 'modified'; before: string | null; after: string | null;
}
export interface Review {
  revision: Revision; changes: ProtectedChange[]; requiresApproval: boolean; approved: boolean;
  glueRoots: string[]; protectedFeatures: string[]; protectedGlue: string[];
  protectionMode: 'whole-feature-and-complete-glue-pool'; intentScenarios: number;
}
export interface Workspace {
  root: string; scenarios: Scenario[]; config: Config; review: Review; diff: string; boundary: string;
}
export interface AnnotationRequest { path: string; line: number; enabled: boolean; sourceHash: string }
export interface ApprovalRequest { revision: Revision; reviewer: string; reason: string; acknowledgement: string }
export interface ApprovalPayload {
  version: 2; revision: Revision; reviewer: string; reason: string; at: string; changes: ProtectedChange[];
}
