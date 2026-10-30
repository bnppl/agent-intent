/** Shared by the standalone report and the CSP-protected local workbench. */
export const lineageStyles = `
:root { font: 15px/1.6 system-ui, sans-serif; color: #19332e; background: #f5f6f1;
  --passed: #205545; --failed: #a13930; --muted: #53665d; --border: #d9e1d6; }
* { box-sizing: border-box; }
body { margin: 0; }
[hidden] { display: none !important; }
header { padding: 20px max(24px, calc((100% - 1100px) / 2)); background: #142f2c; color: #fff; }
header .brand-logo { display: block; width: 216px; max-width: 100%; height: auto; background: #fff; border-radius: 8px; margin-bottom: 14px; }
header p { color: #c7d9c7; margin: 4px 0; }
header .refresh-report { display: inline-block; color: #e0edd9; margin-top: 12px; font-size: .85rem; }
.report-nav { display: flex; gap: 28px; border-bottom: 1px solid var(--border); margin: 0 0 28px; }
.report-nav a { display: inline-flex; align-items: center; gap: 8px; min-height: 48px; padding: 8px 0; text-decoration: none; color: var(--muted); border-bottom: 3px solid transparent; }
.report-nav a[aria-current="page"] { color: var(--passed); border-bottom-color: var(--passed); font-weight: 700; }
.report-nav a:hover { color: var(--passed); }
#pending-count { padding: 0 7px; border-radius: 4px; background: #e5f0e7; font-size: .8rem; }
.view-heading h2, .workflow > h2 { display: block; font-size: 1.5rem; line-height: 1.3; }
.view-heading p { color: var(--muted); margin: 8px 0 24px; }
.workflow { max-width: 760px; }
.workflow > p { color: var(--muted); }
.workflow-step { border-top: 1px solid var(--border); padding: 20px 0; }
.workflow-step h3 { margin: 0 0 12px; font-size: 1.05rem; }
.workflow-step p { margin: 8px 0 12px; }
.workflow-step pre { margin: 12px 0 0; }
.review-empty { padding: 24px 0; color: var(--muted); }
main { max-width: 1148px; margin: auto; padding: 20px 24px 40px; }
h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 10px; letter-spacing: -.025em; }
h2 { display: inline; font-size: 1rem; line-height: 1.5; margin: 0; }
a { color: var(--passed); text-underline-offset: .2em; }
a:hover { text-decoration-thickness: 2px; }
.legend { display: flex; flex-wrap: wrap; gap: 10px; margin: 12px 0 16px; }
.legend-label { color: var(--muted); margin-right: 8px; }
section { border-bottom: 1px solid var(--border); }
.run-group { margin-top: 24px; }
.run-group-title { display: flex; align-items: baseline; gap: 12px; font-size: 1.3rem; font-weight: 700; margin-bottom: 16px; }
.run-group[data-run-group="failed"] > .run-group-title { color: var(--failed); }
.run-group[data-run-group="passed"] > .run-group-title { color: var(--passed); }
.change-group { margin-bottom: 16px; }
.change-group-title { display: flex; align-items: baseline; gap: 12px; padding: 8px; color: var(--muted); font-size: .9rem; font-weight: 650; border-bottom: 1px solid var(--border); }
[data-group-count] { font-size: .8rem; font-weight: 400; color: var(--muted); }
details { padding: 3px 0; }
summary { display: flex; align-items: center; gap: 12px; padding: 10px 8px; cursor: pointer; list-style: none; }
summary::-webkit-details-marker { display: none; }
summary:hover { background: #edf2e9; }
summary h2 { flex: 1; overflow-wrap: anywhere; }
svg { width: 18px; height: 18px; flex: none; }
.expand-icon { color: var(--muted); }
details[open] > summary .expand-icon { transform: rotate(90deg); }
.badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 4px;
  font-size: .8rem; font-weight: 650; white-space: nowrap; }
.result-passed { color: var(--passed); background: #e5f0e7; }
.result-failed { color: var(--failed); background: #fbece8; }
.result-not-run { color: #53665d; background: #e9eeea; }
.change-added { color: #245d85; background: #e7f1fa; }
.change-modified { color: #795126; background: #fff1da; }
.change-removed { color: #714b83; background: #f2eaf7; }
.path, .empty, .help { color: var(--muted); font-size: .85rem; }
.path { overflow-wrap: anywhere; margin: 6px 38px; }
ul { list-style: none; margin: 8px 0 12px 38px; padding: 0; }
li { position: relative; padding: 8px 44px 8px 8px; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 3px 10px; overflow-wrap: anywhere; }
li:nth-child(odd) { background: #edf2e9; }
li .badge { margin-left: auto; }
.empty, .review-actions { margin: 12px 38px 20px; }
button { font: inherit; font-size: .85rem; font-weight: 600; padding: 8px 13px; border: 1px solid var(--passed);
  border-radius: 5px; background: #fff; color: var(--passed); cursor: pointer; }
button:hover { background: #e5f0e7; }
button:disabled { color: var(--muted); border-color: var(--border); cursor: default; }
button:focus-visible, summary:focus-visible, a:focus-visible { outline: 2px solid #205545; outline-offset: 4px; }
::selection { background: #c7ddca; color: #142f2c; }
.message { min-height: 1.6em; color: var(--passed); }
.message.error { color: var(--failed); }
.gherkin-specification, .scenario-lineage, .supporting-tests { margin-left: 38px; }
.gherkin-specification h3, .supporting-tests { font-size: .85rem; color: var(--passed); }
.scenario-lineage, .test-tags { font: .75rem/1.6 ui-monospace, monospace; color: var(--muted); }
.test-tags { grid-column: 1 / -1; }
.test-code { grid-column: 1 / -1; min-width: 0; padding: 0; }
.test-code summary { position: absolute; top: 6px; right: 6px; width: 28px; height: 28px; padding: 0; justify-content: center; border-radius: 3px; font: 600 .85rem/1 ui-monospace, monospace; color: var(--passed); }
.test-code[open] > summary { background: #dce9dc; }
.test-source-location { font-size: .75rem; color: var(--muted); overflow-wrap: anywhere; }
.test-code pre { margin: 8px 0; }
pre .hljs-keyword, pre .hljs-literal, pre .hljs-meta { color: #714b83; }
pre .hljs-string, pre .hljs-regexp { color: #205545; }
pre .hljs-number, pre .hljs-type, pre .hljs-variable { color: #795126; }
pre .hljs-title, pre .hljs-built_in { color: #245d85; }
pre .hljs-comment { color: var(--muted); font-style: italic; }
.spec-change { margin: 0 8px 8px 38px; }
.spec-change summary { font-size: .85rem; color: var(--passed); }
.comparison { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.comparison h3 { font-size: .85rem; margin: 12px 0 8px; }
pre { white-space: pre; overflow: auto; padding: 12px; background: #edf2e9; font: .8rem/1.5 ui-monospace, monospace; }
@media(max-width: 650px) { summary { flex-wrap: wrap; gap: 8px; } summary h2 { flex-basis: calc(100% - 32px); }
  .report-nav { gap: 20px; } .report-nav a { font-size: .9rem; }
  summary .badge { margin-left: 30px; } summary .badge + .badge { margin-left: 0; }
  main { padding: 20px 14px; } li { align-items: start; } ul, .path, .review-actions, .empty, .spec-change, .gherkin-specification, .scenario-lineage, .supporting-tests { margin-left: 8px; }
  .comparison { grid-template-columns: 1fr; } }
`;
