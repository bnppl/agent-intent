export interface Config { version: 1; feature_roots: string[]; editor_url_template?: string }
export interface Scenario {
  id: string; path: string; line: number; name: string; keyword: string; tags: string[];
}
