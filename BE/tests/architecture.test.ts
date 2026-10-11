import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../src/', import.meta.url));
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(fullPath)
      : entry.name.endsWith('.ts')
        ? [fullPath]
        : [];
  });
}
const files = sourceFiles(root);
function parse(file: string) {
  return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
}

describe('backend dependency boundaries', () => {
  it('keeps SQL calls out of routes, controllers and services', () => {
    const violations: string[] = [];
    for (const file of files.filter(
      (file) =>
        /\.(routes|controller|service)\.ts$/.test(file) &&
        file.includes(`${path.sep}modules${path.sep}`),
    )) {
      const source = parse(file);
      function visit(node: ts.Node) {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === 'query'
        )
          violations.push(path.relative(root, file));
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect(violations).toEqual([]);
  });
  it('resolves every relative source import and has no runtime import cycles', () => {
    const graph = new Map<string, string[]>();
    const missing: string[] = [];
    for (const file of files) {
      const dependencies: string[] = [];
      for (const node of parse(file).statements) {
        if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
        if (
          !node.moduleSpecifier ||
          !ts.isStringLiteral(node.moduleSpecifier) ||
          !node.moduleSpecifier.text.startsWith('.')
        )
          continue;
        const target = path.resolve(
          path.dirname(file),
          node.moduleSpecifier.text.replace(/\.js$/, '.ts'),
        );
        if (!existsSync(target))
          missing.push(`${path.relative(root, file)} -> ${node.moduleSpecifier.text}`);
        const typeOnly = ts.isImportDeclaration(node)
          ? node.importClause?.isTypeOnly ||
            (node.importClause?.namedBindings &&
              ts.isNamedImports(node.importClause.namedBindings) &&
              node.importClause.namedBindings.elements.every((element) => element.isTypeOnly))
          : node.isTypeOnly;
        if (!typeOnly) dependencies.push(target);
      }
      graph.set(file, dependencies);
    }
    expect(missing).toEqual([]);
    const active = new Set<string>(),
      visited = new Set<string>(),
      cycles: string[] = [];
    function visit(file: string) {
      if (active.has(file)) {
        cycles.push(path.relative(root, file));
        return;
      }
      if (visited.has(file)) return;
      active.add(file);
      for (const dependency of graph.get(file) ?? []) visit(dependency);
      active.delete(file);
      visited.add(file);
    }
    for (const file of files) visit(file);
    expect(cycles).toEqual([]);
  });
});
