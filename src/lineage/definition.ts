interface Table { rows: { cells: { value: string }[] }[] }
interface DefinitionNode {
  keyword: string; name: string; description?: string; tags?: { name: string }[];
  backgrounds?: DefinitionNode[]; steps?: { keyword: string; text: string; dataTable?: Table;
    docString?: { delimiter: string; mediaType?: string; content: string } }[];
  examples?: { keyword: string; name: string; description?: string; tags: { name: string }[];
    tableHeader?: { cells: { value: string }[] }; tableBody: { cells: { value: string }[] }[] }[];
}

/** Present stored Gherkin meaning in domain language instead of parser metadata. */
export function definitionText(definition: string): string {
  const value = JSON.parse(definition) as { contexts: DefinitionNode[]; scenario: DefinitionNode };
  const lines: string[] = [];
  const row = (cells: { value: string }[]) => '    | ' + cells.map(cell => cell.value.replaceAll('|', '\\|').replaceAll('\n', '\\n')).join(' | ') + ' |';
  function block(node: DefinitionNode): void {
    if (node.tags?.length) lines.push(node.tags.map(tag => tag.name).join(' '));
    lines.push(node.keyword + ': ' + node.name);
    if (node.description) lines.push(node.description);
    for (const background of node.backgrounds ?? []) block(background);
    for (const step of node.steps ?? []) {
      lines.push('  ' + step.keyword + step.text);
      if (step.dataTable) lines.push(...step.dataTable.rows.map(cells => row(cells.cells)));
      if (step.docString) lines.push('    ' + step.docString.delimiter + (step.docString.mediaType ?? ''), step.docString.content, '    ' + step.docString.delimiter);
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
  return lines.join('\n');
}
