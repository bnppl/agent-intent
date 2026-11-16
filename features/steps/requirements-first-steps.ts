import { After, Given, Then, When } from '@cucumber/cucumber';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert, logEvidence, spawnWithEvidence } from '../support/evidence.js';
import { PresentationDriver } from '../support/presentation-driver.js';

const cli = fileURLToPath(new URL('../../runtime/cli.cjs', import.meta.url));
const problemHeading = '## Problem statement';
const requirementsHeading = '## High-level requirements';
let driver: PresentationDriver | undefined;
let problem: string;
let requirement: string;
let initialisation: ReturnType<typeof spawnWithEvidence>;
let html: string;

function emptyProject(): void {
  driver = new PresentationDriver();
  problem = '';
  requirement = '';
  logEvidence('Fixture', 'Created an empty project directory.');
}

function brief(): string {
  return `${problemHeading}\n\n${problem}\n\n${requirementsHeading}\n\n${requirement ? '- ' + requirement + '\n' : ''}`;
}

function writeBrief(): void {
  driver!.write('intent.md', brief());
  logEvidence('Fixture brief', brief());
}

async function loadPage(): Promise<void> {
  const response = await driver!.request('/');
  html = await response.text();
  assert.equal(response.status, 200, response.ok ? undefined : html);
  const briefMarkup = html.match(/<article class="project-brief"[\s\S]*?<\/article>/)?.[0];
  if (briefMarkup) logEvidence('Project brief in response body', briefMarkup);
}

After({ tags: '@starter-intent-template or @starter-intent-preserve or @starter-intent-preview or @starter-intent-incomplete' }, async () => {
  await driver?.stop();
  driver = undefined;
});

Given('a project folder without a project brief', emptyProject);
Given('a project with no application code, Gherkin scenarios, or test results', emptyProject);
Given('a project folder with a completed brief', () => {
  emptyProject();
  problem = 'People need a way to see their reservations.';
  requirement = 'A guest can list their upcoming reservations.';
  writeBrief();
});
Given('its problem statement is {string}', (value: string) => { problem = value; logEvidence('Problem statement', value); });
Given('its high-level requirement is {string}', (value: string) => { requirement = value; logEvidence('High-level requirement', value); });
Given(/^a project brief missing (the problem statement|at least one high-level requirement)$/, (part: string) => {
  emptyProject();
  if (part === 'the problem statement') requirement = 'A guest can list their upcoming reservations.';
  else problem = 'People need a way to see their reservations.';
});

function initialise(): void {
  initialisation = spawnWithEvidence(process.execPath, [cli, 'init'], { cwd: driver!.root, encoding: 'utf8' });
}
When('I initialise its Agent Intent brief', initialise);
When('I initialise its Agent Intent brief again', initialise);
When('I open its interactive Agent Intent report', async () => {
  writeBrief();
  await loadPage();
});

Then('the template tells me how to replace its instructions with my own problem statement and requirements', () => {
  assert.equal(initialisation.status, 0, initialisation.stderr);
  assert.deepEqual(readdirSync(driver!.root), ['intent.md']);
  const template = readFileSync(join(driver!.root, 'intent.md'), 'utf8');
  assert.match(template, /## Problem statement\s+<!-- Replace this comment with .*problem/is);
  assert.match(template, /## High-level requirements\s+<!-- Replace this comment with at least one bullet/is);
  assert.match(template, /one sentence.*one piece of functionality or one user journey/is);
  assert.doesNotMatch(template, /trebuchet|launch setup/i);
});
Then('the untouched template is shown as an incomplete brief', async () => {
  await loadPage();
  assert.match(html, /Write a problem statement/);
  assert.match(html, /Add at least one high-level requirement/);
  assert.doesNotMatch(html, /Replace this comment/);
});
Then('Agent Intent reports that the brief already exists', () => {
  assert.notEqual(initialisation.status, 0);
  assert.match(initialisation.stderr, /intent\.md already exists/i);
});
Then('the completed brief is preserved', () => {
  assert.equal(readFileSync(join(driver!.root, 'intent.md'), 'utf8'), brief());
});
Then('I see the problem statement above the list of high-level requirements', () => {
  const heading = html.indexOf('>High-level requirements<');
  const statement = html.indexOf(problem), item = html.indexOf(requirement, heading);
  assert.ok(statement > html.indexOf('>Problem statement<') && html.includes('>Problem statement<'), 'Problem statement appears under its heading');
  assert.ok(item > html.indexOf('>High-level requirements<') && html.includes('>High-level requirements<'), 'Requirement appears under its heading');
  assert.ok(statement < item, 'The problem statement precedes the high-level requirements');
});
Then('the report indicates that no tests have run', () => {
  assert.match(html, /No tests have run/);
  assert.deepEqual(readdirSync(driver!.root), ['intent.md']);
});
Then(/^the report identifies (the problem statement|at least one high-level requirement) as required to complete the brief$/, (part: string) => {
  if (part === 'the problem statement') {
    assert.match(html, /Write a problem statement/);
    assert.match(html, /A guest can list their upcoming reservations\./);
    assert.doesNotMatch(html, /Add at least one high-level requirement/);
  } else {
    assert.match(html, /Add at least one high-level requirement/);
    assert.match(html, /People need a way to see their reservations\./);
    assert.doesNotMatch(html, /Write a problem statement/);
  }
});
