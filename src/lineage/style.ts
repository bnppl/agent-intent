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
.report-nav { display: flex; flex-wrap: wrap; gap: 28px; border-bottom: 1px solid var(--border); margin: 0 0 28px; }
.report-nav a { display: inline-flex; align-items: center; gap: 8px; min-height: 48px; padding: 8px 0; text-decoration: none; color: var(--muted); border-bottom: 3px solid transparent; }
.report-nav a[aria-current="page"] { color: var(--passed); border-bottom-color: var(--passed); font-weight: 700; }
.report-nav a:hover { color: var(--passed); }
#pending-count { padding: 0 7px; border-radius: 4px; background: #e5f0e7; font-size: .8rem; }
.view-heading h2, .workflow > h2 { display: block; font-size: 1.5rem; line-height: 1.3; }
.view-heading p { color: var(--muted); margin: 8px 0 24px; }
.requirement-group { margin: 24px 0; padding: 0 0 0 16px; border-left: 1px solid var(--border); }
.requirement-group > h2 { display: block; margin-bottom: 12px; }
.project-brief { max-width: 760px; padding-bottom: 16px; margin-bottom: 20px; border-bottom: 1px solid var(--border); }
.project-brief h2 { display: block; font-size: 1.25rem; }
.project-brief .problem-statement { white-space: pre-line; overflow-wrap: anywhere; }
.project-brief ul { list-style: disc; margin-left: 1.5em; }
.project-brief li { display: list-item; padding: 4px 0; background: transparent; }
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
.gherkin-source { background: #edf2e9; padding: 16px 0; }
.gherkin-source > pre { margin: 0; padding: 0 16px; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.6; }
.gherkin-source > .gherkin-context + pre, .gherkin-source > .gherkin-scenario { margin-top: 24px; }
.gherkin-source > .gherkin-scenario { padding-left: 32px; margin-bottom: 12px; }
.gherkin-source :is(pre, .step-text) .hljs-meta { color: var(--muted); }
.step-evidence { padding: 0; }
.step-evidence summary, .step-without-evidence { align-items: baseline; gap: 8px; padding: 4px 12px; }
.step-without-evidence { display: flex; flex-wrap: wrap; padding-left: 34px; }
.step-evidence summary:hover, .step-evidence[open] > summary { background: #e0ebdf; }
.step-evidence summary .expand-icon { align-self: start; width: 14px; height: 14px; margin-top: 3px; }
.gherkin-source .step-text { flex: 1 1 14rem; min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: .8rem/1.6 ui-monospace, monospace; }
.step-evidence small { color: var(--muted); white-space: nowrap; }
.step-run { margin: 0 12px 8px 36px; }
.step-run h4 { margin: 8px 0 4px; font-size: .85rem; }
.step-run pre { background: #f9faf6; margin: 4px 0; max-height: 24rem; }
.step-run .empty { margin: 4px 0; }
.scenario-lineage, .test-tags { font: .75rem/1.6 ui-monospace, monospace; color: var(--muted); }
.test-tags { grid-column: 1 / -1; }
.test-code { grid-column: 1 / -1; min-width: 0; padding: 0; }
.test-code summary { position: absolute; top: 6px; right: 6px; width: 28px; height: 28px; padding: 0; justify-content: center; border-radius: 3px; font: 600 .85rem/1 ui-monospace, monospace; color: var(--passed); }
.test-code[open] > summary { background: #dce9dc; }
.test-source-location { font-size: .75rem; color: var(--muted); overflow-wrap: anywhere; }
.test-code pre { margin: 8px 0; }
:is(pre, .step-text) .hljs-keyword, :is(pre, .step-text) .hljs-literal, :is(pre, .step-text) .hljs-meta { color: #714b83; }
:is(pre, .step-text) .hljs-string, :is(pre, .step-text) .hljs-regexp { color: #205545; }
:is(pre, .step-text) .hljs-number, pre .hljs-type, :is(pre, .step-text) .hljs-variable { color: #795126; }
:is(pre, .step-text) .hljs-title, :is(pre, .step-text) .hljs-built_in { color: #245d85; }
:is(pre, .step-text) .hljs-comment { color: var(--muted); font-style: italic; }
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

/* A persistent outline and one detail stage keep the report in context. */
[data-report-stack] { max-width: 1480px; display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 40px; align-items: start; padding: 32px; min-height: 100vh; }
[data-report-stack]:not([data-navigation-ready]):not([data-fractal-ready]) { display: block; max-width: 1000px; }
[data-report-stack]:not([data-navigation-ready]):not([data-fractal-ready]) .report-outline { display: none; }
.workspace-stage { min-width: 0; view-transition-name: report-stage; }
.report-outline { position: sticky; top: 32px; max-height: calc(100vh - 64px); overflow: auto; scrollbar-width: thin; scrollbar-color: #9fb6a8 transparent; }
.outline-heading { display: flex; align-items: center; justify-content: space-between; min-height: 64px; padding-bottom: 20px; margin-bottom: 20px; border-bottom: 1px solid var(--border); }
.report-brand { color: #173e38; font-size: 1.25rem; font-weight: 750; letter-spacing: -.025em; }
[data-outline-toggle] { display: none; }
.report-outline nav button { display: block; width: 100%; min-height: 40px; padding: 9px 12px; border: 0; border-radius: 6px; background: transparent; color: var(--muted); font-size: .85rem; font-weight: 450; line-height: 1.4; text-align: left; overflow-wrap: anywhere; }
.report-outline nav button:hover { background: #e8eee6; color: #173e38; }
.report-outline nav button[aria-current="page"] { background: #dfeae0; color: #173e38; font-weight: 650; }
.report-outline [data-outline-home] { font-weight: 650; }
.outline-group { margin-top: 22px; }
.report-outline nav [data-outline-requirement] { color: #294c40; font-weight: 650; }
.outline-id { display: block; margin-bottom: 5px; color: #4f685c; font-size: .75rem; font-variant-numeric: tabular-nums; }
.outline-scenario { margin: 5px 0 0 12px; padding-left: 12px; border-left: 1px solid var(--border); }
.report-outline nav .outline-components { display: flex; align-items: center; gap: 10px; color: #426653; }
.outline-components > span { margin-left: auto; padding: 1px 6px; border-radius: 4px; background: #e5ece3; font-size: .75rem; font-variant-numeric: tabular-nums; }
.stack-navigation { position: sticky; top: 24px; z-index: 5; display: grid; grid-template-columns: 84px minmax(0, 1fr); align-items: center; gap: 16px; height: 64px; padding: 10px 16px; margin-bottom: 32px; border-radius: 8px; background: #173e38; color: #f1f6ed; }
.stack-navigation [data-stack-back] { display: flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; padding: 8px; border: 1px solid #789a88; color: #f1f6ed; background: transparent; }
.stack-navigation [data-stack-back]:disabled { opacity: .5; cursor: default; }
.stack-navigation [data-stack-back]:not(:disabled):hover { background: #29574b; }
.stack-navigation nav { min-width: 0; overflow: hidden; }
.stack-navigation ol { display: flex; align-items: center; gap: 10px; list-style: none; margin: 0; padding: 0; }
.stack-navigation li { display: flex; align-items: center; gap: 10px; flex: 0 1 auto; min-width: 0; padding: 0; background: transparent; font-size: .8rem; }
.stack-navigation li:first-child { flex-shrink: 0; }
.stack-navigation li:last-child { flex: 0 0 auto; max-width: 55%; }
.stack-navigation li + li::before { content: '/'; color: #a4c3b5; }
.stack-navigation li :is(button, span) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stack-navigation li button { min-height: 40px; padding: 4px 0; border: 0; background: transparent; color: #c9e3d3; text-align: left; text-decoration: underline; text-underline-offset: .25em; }
.stack-navigation [aria-current] { color: #fff; font-weight: 650; }
.stack-navigation :is(button, a):focus-visible { outline-color: #f4cd82; }
[data-stack-content] { min-height: calc(100vh - 160px); overflow-anchor: none; }
[data-report-stack] .project-brief { max-width: 72ch; border: 0; padding: 0; margin: 0 0 32px; }
[data-report-stack] .project-brief h2 { margin: 0 0 16px; font-size: 1.5rem; line-height: 1.3; color: #173e38; }
[data-report-stack] .problem-statement { max-width: 72ch; margin: 0 0 40px; font-size: 1.05rem; }
[data-report-stack] .requirement-group { border: 0; padding: 0; margin: 0; }
[data-report-stack] .requirement-level { border-bottom: 1px solid var(--border); }
[data-report-stack] .requirement-level > summary { min-height: 64px; padding: 16px 10px; }
[data-report-stack] .requirement-level:not([open]) > summary { color: #245d85; border-radius: 6px; }
[data-report-stack] .requirement-level:not([open]) > summary:hover { background: #e5eee8; }
[data-report-stack] .stack-back { display: none; }
[data-report-stack]:has(.requirement-level[open]) .stack-overview,
[data-report-stack]:has(.requirement-level[open]) .requirement-group:not(:has(> .requirement-level[open])) { display: none; }
[data-report-stack] .requirement-level[open] { border-bottom: 0; }
[data-stack-rows]:has(.specification-level[open]) > section:not(:has(> .specification-level[open])),
.requirement-level:has(.specification-level[open]) > summary { display: none; }
[data-navigation-ready] .requirement-level[open] > summary,
[data-navigation-ready] .specification-level[open] > summary { display: flex; align-items: flex-start; cursor: default; padding: 0 0 20px; margin: 0; }
[data-navigation-ready] .requirement-level[open] > summary h2,
[data-navigation-ready] .specification-level[open] > summary h2 { font-size: 1.5rem; line-height: 1.35; color: #173e38; }
[data-navigation-ready] details[open] > summary > .expand-icon { display: none; }
[data-navigation-ready] details[open] > summary:hover { background: transparent; }
.workspace-stage .specification-actions { padding: 0; margin: 4px 0 20px; }
.workspace-stage :is(.path, .gherkin-specification, .scenario-lineage, .supporting-tests, .spec-change) { margin-left: 0; }
.workspace-stage .path { margin: 0 0 20px; }
.workspace-stage section > details > ul { margin-left: 0; }
.workspace-stage .empty { margin-left: 0; }
.workspace-stage .gherkin-source { border-radius: 6px; }
.workspace-stage .step-evidence > summary { min-height: 44px; }
.workspace-stage .step-evidence small { font-variant-numeric: tabular-nums; }
.workspace-stage > .approval-panel { display: none; }
.workspace-stage:has(.specification-level[open]) > .approval-panel { display: block; }
.support-link { display: inline-flex; align-items: center; gap: 8px; min-height: 36px; margin: 8px 12px 14px; padding: 6px 12px; border: 1px solid #c4d5c8; border-radius: 6px; background: #e4eee5; font-size: .85rem; font-weight: 650; text-decoration: none; }
.support-link:hover { background: #d9e8dc; }
.support-link .expand-icon { width: 15px; height: 15px; color: currentColor; }
.support-diagnostic { color: #8b2c22; margin: 12px; }
.support-feature { margin: 32px 0 40px; }
.support-view-active main:not([data-report-stack]) > :not([data-support-view]),
.support-view-active header,
.support-view-active [data-stack-content] { display: none !important; }
[data-support-view][hidden], [data-support-library][hidden] { display: none !important; }
[data-support-view] { padding: 0; }
[data-support-view] > [data-support-back] { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; margin-bottom: 24px; }
[data-support-back] .expand-icon { transform: rotate(180deg); }
[data-navigation-ready] [data-support-view] > [data-support-back] { display: none; }
[data-support-view] > h2 { display: block; font-size: 1.5rem; line-height: 1.35; color: #173e38; margin-bottom: 8px; }
[data-support-view] > p { color: var(--muted); margin: 0 0 28px; overflow-wrap: anywhere; }
.support-feature > h3 { margin: 0 0 16px; font-size: 1.1rem; line-height: 1.5; overflow-wrap: anywhere; }
.support-feature > h3 > small { display: block; margin-top: 4px; font: .75rem/1.6 ui-monospace, monospace; color: var(--muted); font-weight: 400; }
.support-component { margin: 32px 0; }
.component-name { margin: 0 0 12px; font-size: 1.1rem; color: #173e38; }
.support-component .support-feature { margin: 0 0 16px; }
.support-component .support-feature > h3 { font-size: 1rem; }
.outline-component-name { margin: 16px 12px 4px; font-size: .8rem; font-weight: 650; color: #294c40; }
[data-navigation-ready] [data-feature-depth] > .support-component:not(:has([data-drill-active])),
[data-navigation-ready] [data-feature-depth] .component-name { display: none; }
[data-navigation-ready] [data-feature-depth] > .support-component { margin-top: 0; }
/* Every selected component, scenario and evidence step owns the detail stage. */
[data-navigation-ready] .support-feature > h3 > button { display: block; width: 100%; padding: 16px 10px; text-align: left; font: inherit; border: 0; border-bottom: 1px solid var(--border); border-radius: 0; background: transparent; }
[data-drill-feature] small { display: block; margin-top: 6px; color: var(--muted); font: .75rem/1.6 ui-monospace, monospace; }
[data-navigation-ready] .support-feature:not([data-drill-active]) > [data-support-child] { display: none; }
[data-navigation-ready] [data-feature-depth] > :is(h2, p),
[data-navigation-ready] [data-feature-depth] .support-feature:not([data-drill-active]) { display: none; }
[data-navigation-ready] .support-feature[data-drill-active] { margin-top: 0; }
[data-navigation-ready] .support-feature[data-drill-active] > h3 > button { cursor: default; padding: 0 0 24px; border: 0; font-size: 1.5rem; }
[data-navigation-ready] .support-feature:has(.specification-level[data-drill-active]) > h3,
[data-navigation-ready] .support-feature:has(.specification-level[data-drill-active]) > [data-support-child]:not(:has(.specification-level[data-drill-active])) { display: none; }
[data-navigation-ready] .specification-level:has(.step-evidence[data-drill-active]) > :not(.gherkin-specification),
[data-navigation-ready] .gherkin-specification:has(.step-evidence[data-drill-active]) > h3,
[data-navigation-ready] .gherkin-source:has(.step-evidence[data-drill-active]) > :not(.step-evidence[data-drill-active]) { display: none; }
[data-navigation-ready] .step-evidence[data-drill-active] > summary { padding: 0 0 24px; }
[data-navigation-ready] .step-evidence[data-drill-active] .step-text { font: 650 1.25rem/1.5 system-ui, sans-serif; }
[data-navigation-ready] .step-evidence[data-drill-active] .step-run { margin-left: 0; }
[data-outline-detail] { margin-top: 8px; }
.report-outline nav [data-outline-kind="scenario"] { padding-left: 24px; }
.report-outline nav [data-outline-kind="step"] { padding-left: 36px; font-size: .8rem; }
::view-transition-old(root), ::view-transition-new(root) { animation: none; }
::view-transition-old(report-stage), ::view-transition-new(report-stage) { animation-duration: 180ms; animation-timing-function: cubic-bezier(.16, 1, .3, 1); }
@media (max-width: 960px) {
  [data-report-stack] { display: block; padding: 20px; }
  .report-outline { position: relative; top: auto; max-height: none; overflow: visible; margin-bottom: 16px; }
  .outline-heading { min-height: 44px; padding: 0; margin: 0; border: 0; }
  [data-outline-toggle] { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; }
  .report-outline nav { display: none; max-height: 55vh; overflow: auto; padding: 16px 0; border-bottom: 1px solid var(--border); }
  [data-report-stack][data-outline-open] .report-outline nav { display: block; }
  .stack-navigation { top: 12px; gap: 12px; margin-bottom: 28px; }
}
@media (max-width: 600px) {
  [data-report-stack] { padding: 16px; }
  .stack-navigation { grid-template-columns: 64px minmax(0, 1fr); gap: 10px; padding: 10px; }
  .stack-navigation li { font-size: .75rem; }
  .stack-navigation li:not(:last-child) { display: none; }
  .stack-navigation li:last-child { max-width: 100%; flex: 1 1 auto; }
  .stack-navigation li:last-child::before { display: none; }
  .workspace-stage summary { flex-wrap: wrap; }
  .workspace-stage summary h2 { flex-basis: calc(100% - 30px); }
  .workspace-stage summary .badge { margin-left: 0; }
  [data-navigation-ready] .specification-level[open] > summary h2 { font-size: 1.25rem; }
}
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(report-stage), ::view-transition-new(report-stage) { animation: none; }
}

[data-fractal-report] [data-result="failed"] > details > summary,
[data-fractal-report] [data-result="failed"] > details > summary h2,
.step-evidence[data-result="failed"] > summary,
[data-component-spec][data-result="failed"] > h3,
.report-outline button[data-result="failed"] { color: var(--failed); }
[data-result="failed"] > details > summary .expand-icon,
.step-evidence[data-result="failed"] > summary .expand-icon { color: var(--failed); }

/* Fractal report: disclosure and navigation are separate actions at every depth. */
[data-fractal-report] .report-outline { display: block !important; }
[data-fractal-report] .requirement-group,
[data-fractal-report] .stack-overview,
[data-fractal-report] [data-stack-rows] > section,
[data-fractal-report] .requirement-level > summary { display: block; }
[data-fractal-report] .requirement-level > summary { display: flex; }
[data-fractal-report] summary { cursor: pointer; }
[data-fractal-report] summary h2 { font-size: 1rem; margin: 0; }
[data-fractal-report] summary [data-spec-title] { color: inherit; text-decoration: none; }
[data-fractal-report] summary [data-spec-title]:hover { text-decoration: underline; }
[data-fractal-report] summary .expand-icon { display: inline-block; flex-shrink: 0; }
/* Align disclosed content with the parent label, including nested handles. */
[data-fractal-report] .workspace-stage details > :not(summary) { margin-left: 38px; }
[data-fractal-report] .gherkin-source > :is(.step-evidence, .step-without-evidence) { margin-left: 32px; }
[data-fractal-report] .workspace-stage .step-evidence > .step-run { margin-left: 48px; }
[data-fractal-report] .sub-specifications { padding: 12px; border-left: 2px solid var(--border); }
[data-fractal-report] [data-unit-spec] { display: block; padding: 0; }
[data-fractal-report] [data-unit-spec] > details > summary { min-height: 44px; }
[data-fractal-report] .stack-navigation a { color: #c9e3d3; }
[data-fractal-report] .stack-navigation li a { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
[data-fractal-report] .focused-specification > :is(section, article, li) { margin: 0; padding: 0; }
[data-fractal-report] .focused-specification > * > details > summary h2 { font-size: 1.5rem; }
[data-fractal-report] [hidden] { display: none !important; }

[data-report-stack][data-fractal-report]:has(.requirement-level[open]) .stack-overview,
[data-report-stack][data-fractal-report]:has(.requirement-level[open]) .requirement-group,
[data-fractal-report] [data-stack-rows]:has(.specification-level[open]) > section { display: block !important; }
[data-fractal-report] .requirement-level:has(.specification-level[open]) > summary { display: flex; }

[data-fractal-report] .step-evidence > summary > [data-spec-title] { flex: 1 1 14rem; min-width: 0; }
[data-fractal-report] [data-component-spec] > h3 a { color: inherit; }
[data-fractal-report] .focused-specification > .step-evidence { background: #edf2e9; }

 .execution-tabs { min-width: 0; }
.execution-tabs > [role="tablist"] { display: flex; align-items: stretch; flex-wrap: wrap; margin: 0 0 16px; border-bottom: 1px solid var(--border); }
.examples-label { display: flex; align-items: center; padding-right: 16px; font-weight: 600; }
.execution-tabs > [role="tablist"] > [role="tab"] { min-width: 44px; min-height: 44px; padding: 8px 14px; border: 0; border-bottom: 3px solid transparent; border-radius: 0; background: transparent; color: var(--muted); box-shadow: none; font-size: 1rem; }
.execution-tabs > [role="tablist"] > [role="tab"]:hover { color: var(--passed); background: #edf2e9; }
.execution-tabs > [role="tablist"] > [aria-selected="true"] { color: var(--passed); border-bottom-color: var(--passed); font-weight: 750; }
.execution-tabs > [role="tabpanel"][hidden] { display: none !important; }
.execution-result { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; color: var(--muted); font-size: .8rem; }

.decision-inbox { max-width: 960px; margin: auto; }
.decision-group { margin: 2rem 0; }
.decision-item { padding: 1.25rem 0; border-top: 1px solid var(--border, #ccc); }
.decision-item label { display: grid; gap: .4rem; margin: 1rem 0; }
.decision-item textarea, .decision-item select { width: 100%; max-width: 46rem; font: inherit; padding: .6rem; box-sizing: border-box; }
.decision-item pre { white-space: pre-wrap; overflow-wrap: anywhere; }
`;
