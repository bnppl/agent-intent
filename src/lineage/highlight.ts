import hljs from 'highlight.js/lib/core';
import gherkin from 'highlight.js/lib/languages/gherkin';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';

hljs.registerLanguage('gherkin', gherkin);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);

export function highlightedSource(code: string, path: string): string {
  return hljs.highlight(code, { language: /\.feature$/i.test(path) ? 'gherkin' : /\.[cm]?tsx?$/i.test(path) ? 'typescript' : 'javascript', ignoreIllegals: true }).value;
}
