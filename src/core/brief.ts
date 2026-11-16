import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { IntentError } from './files.js';

export const briefFile = 'intent.md';
const problemHeading = 'Problem statement';
const requirementsHeading = 'High-level requirements';
const template = `# Project intent

## ${problemHeading}

<!-- Replace this comment with a short paragraph describing the problem, who has it, and what you want to improve. -->

## ${requirementsHeading}

<!-- Replace this comment with at least one bullet starting with a hyphen. Write each bullet as one sentence about one piece of functionality or one user journey. -->
`;

export interface Requirement { id?: string; text: string }
export function requirement(value: string): Requirement {
  const match = value.match(/^\*\*(REQ-\d+)\*\*\s+(.+)$/i);
  return match ? { id: match[1].toLowerCase(), text: match[2] } : { text: value };
}
export interface ProjectBrief { problemStatement: string; requirements: string[] }

export function initialiseBrief(root: string): void {
  try { writeFileSync(join(root, briefFile), template, { flag: 'wx' }); }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      throw new IntentError(`${briefFile} already exists. Edit it to update your project brief.`);
    }
    throw error;
  }
}

export function readBrief(root: string): ProjectBrief | undefined {
  const path = join(root, briefFile);
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (!stat) return undefined;
  if (!stat.isFile()) throw new IntentError(`${briefFile} must be a regular file`);

  const sections = new Map<string, string>();
  const markdown = readFileSync(path, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  for (const section of markdown.split(/^##[ \t]+/m).slice(1)) {
    const newline = section.indexOf('\n');
    if (newline < 0) continue;
    sections.set(section.slice(0, newline).trim().toLowerCase(), section.slice(newline + 1).trim());
  }

  const requirements = (sections.get(requirementsHeading.toLowerCase()) ?? '').split('\n')
    .map(line => line.trim().match(/^[-*+]\s+(.+)$/)?.[1] ?? '').filter(Boolean);
  return { problemStatement: sections.get(problemHeading.toLowerCase()) ?? '', requirements };
}
