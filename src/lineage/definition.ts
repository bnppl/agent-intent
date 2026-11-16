interface Table { rows: { cells: { value: string }[] }[] }
interface DefinitionNode {
  keyword: string; name: string; description?: string; tags?: { name: string }[];
  backgrounds?: DefinitionNode[]; steps?: { keyword: string; text: string; dataTable?: Table;
    docString?: { delimiter: string; mediaType?: string; content: string } }[];
  examples?: { keyword: string; name: string; description?: string; tags: { name: string }[];
    tableHeader?: { cells: { value: string }[] }; tableBody: { cells: { value: string }[] }[] }[];
}

interface DefinitionPart { text: string; step?: true; level?: 'context' | 'scenario' }

/** Preserve Gherkin source order and keep a step's arguments with its text. */
export function definitionParts(definition: string): DefinitionPart[] {
  const value = JSON.parse(definition) as { contexts: DefinitionNode[]; scenario: DefinitionNode };
  const parts: DefinitionPart[] = [];
  const lines: string[] = [];
  let level: DefinitionPart['level'];
  function flush(): void {
    if (lines.length) parts.push({ text: lines.splice(0).join('\n'), level });
  }
  const row = (cells: { value: string }[]) => '    | ' + cells.map(cell => cell.value.replaceAll('|', '\\|').replaceAll('\n', '\\n')).join(' | ') + ' |';
  function block(node: DefinitionNode): void {
    flush();
    level = node === value.scenario ? 'scenario' : 'context';
    if (node.tags?.length) lines.push(node.tags.map(tag => tag.name).join(' '));
    lines.push(node.keyword + ': ' + node.name);
    if (node.description) lines.push(node.description);
    for (const background of node.backgrounds ?? []) block(background);
    for (const step of node.steps ?? []) {
      flush();
      const source = ['  ' + step.keyword + step.text];
      if (step.dataTable) source.push(...step.dataTable.rows.map(cells => row(cells.cells)));
      if (step.docString) source.push('    ' + step.docString.delimiter + (step.docString.mediaType ?? ''), step.docString.content, '    ' + step.docString.delimiter);
      parts.push({ text: source.join('\n'), step: true });
    }
    for (const examples of node.examples ?? []) {
      lines.push(examples.tags.map(tag => tag.name).join(' '), '  ' + examples.keyword + ': ' + examples.name);
      if (examples.description) lines.push(examples.description);
      if (examples.tableHeader) lines.push(row(examples.tableHeader.cells));
      lines.push(...examples.tableBody.map(cells => row(cells.cells)));
    }
  }
  for (const context of value.contexts) block(context);
  block(value.scenario);
  flush();
  return parts;
}

/** Present stored Gherkin meaning in domain language instead of parser metadata. */
export function definitionText(definition: string): string {
  return definitionParts(definition).map(part => part.text).join('\n');
}

/** Substitute once, before HTML highlighting, without changing stored specification meaning. */
export function executionDefinition(definition: string, values: Record<string, string> = {}, name?: string): string {
  const value = JSON.parse(definition);
  delete value.scenario.examples;
  if (name !== undefined) value.scenario.name = name;
  function substitute(item: unknown): unknown {
    if (typeof item === 'string') return item.replace(/<([^<>]+)>/g, (token, key: string) => Object.hasOwn(values, key) ? values[key] : token);
    if (Array.isArray(item)) return item.map(substitute);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, substitute(child)]));
    return item;
  }
  // The execution name has already been interpolated by Cucumber.
  const output = substitute(value) as typeof value;
  if (name !== undefined) output.scenario.name = name;
  return JSON.stringify(output);
}
