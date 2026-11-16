import { it } from 'node:test';
import { DecisionInboxDriver } from '../features/support/decision-inbox-driver.js';

it('reviews and persists scoped decisions separately from specification acceptance', { tags: ['decision-inbox-review'] }, async () => {
  const driver = new DecisionInboxDriver();
  try { driver.proposals(); await driver.open(); await driver.grouped(); await driver.classify(); driver.independent(); await driver.unresolved(); }
  finally { await driver.close(); }
});
it('rejects stale classifications without changing persisted state', { tags: ['decision-inbox-stale'] }, async () => {
  const driver = new DecisionInboxDriver();
  try { driver.proposals(); await driver.open(); driver.change(); await driver.stale(); }
  finally { await driver.close(); }
});
it('imports mutation survivors and reopens changed evidence', { tags: ['decision-inbox-mutations'] }, async () => {
  const driver = new DecisionInboxDriver();
  try { driver.mutations(); driver.importMutations(); await driver.mutationEvidence(); await driver.reimport(); }
  finally { await driver.close(); }
});
it('rejects duplicate imports atomically', { tags: ['decision-inbox-validation'] }, async () => {
  const driver = new DecisionInboxDriver();
  try { driver.proposals(); driver.duplicates(); driver.preserved(); }
  finally { await driver.close(); }
});

import { classifyDecision, decisionInbox, importDecisionProposals, importMutationReport } from '../src/decisions.js';
import { assert } from '../features/support/evidence.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

it('requires a valid classification, scope and rationale without altering state on rejection', { tags: ['component:Decision-Store', 'supports:decision-inbox-review:4'] }, async () => {
  const driver = new DecisionInboxDriver();
  try {
    driver.proposals();
    const before = decisionInbox(driver.root);
    for (const fields of [{ classification: 'flexible', scope: '', rationale: 'why' }, { classification: 'flexible', scope: 'ordering', rationale: ' ' }, { classification: 'ignored', scope: 'ordering', rationale: 'why' }]) {
      assert.throws(() => classifyDecision(driver.root, { revision: before.revision, id: 'material-order', ...fields }), /required/);
      assert.deepEqual(decisionInbox(driver.root), before);
    }
    assert.throws(() => classifyDecision(driver.root, { revision: before.revision, id: 'missing', classification: 'protect', scope: 'limit', rationale: 'required' }), /not found/);
    assert.deepEqual(decisionInbox(driver.root), before);
  } finally { await driver.close(); }
});

it('validates all mutation findings before importing any and leaves tool errors out of flexibility decisions', { tags: ['component:Mutation-Adapter', 'supports:decision-inbox-mutations:2'] }, async () => {
  const driver = new DecisionInboxDriver();
  try {
    driver.proposals(); driver.mutations();
    const before = decisionInbox(driver.root);
    const report = JSON.parse(readFileSync(join(driver.root, 'mutation.json'), 'utf8'));
    report.files['src/rules.js'].mutants[1].status = 'Unrecognised';
    assert.throws(() => importMutationReport(driver.root, report), /Invalid mutation/);
    assert.deepEqual(decisionInbox(driver.root), before);
    report.files['src/rules.js'].mutants[1].status = 'RuntimeError';
    assert.equal(importMutationReport(driver.root, report), 1);
    assert.equal(decisionInbox(driver.root).items.length, 3);
  } finally { await driver.close(); }
});

it('keeps decisions bound to proposal evidence and never imports a supplied human decision', { tags: ['component:Decision-Store', 'supports:decision-inbox-mutations:4'] }, async () => {
  const driver = new DecisionInboxDriver();
  try {
    driver.proposals(); const before = decisionInbox(driver.root);
    importDecisionProposals(driver.root, { version: 1, items: [{ ...driver.proposal, decision: { classification: 'flexible' } }] });
    assert.deepEqual(decisionInbox(driver.root), before);
    classifyDecision(driver.root, { revision: before.revision, id: 'material-order', classification: 'flexible', scope: 'ordering', rationale: 'irrelevant to quantities' });
    const decided = decisionInbox(driver.root);
    importDecisionProposals(driver.root, { version: 1, items: [driver.proposal] });
    assert.deepEqual(decisionInbox(driver.root), decided);
    importDecisionProposals(driver.root, { version: 1, items: [{ ...driver.proposal, evidence: 'New ordering behavior' }] });
    const changed = decisionInbox(driver.root).items[0];
    assert.notEqual(changed.fingerprint, changed.decision?.fingerprint);
    assert.equal(changed.decision?.scope, 'ordering');
  } finally { await driver.close(); }
});
