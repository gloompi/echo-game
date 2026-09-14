#!/usr/bin/env node
// @ts-check
import { builtinModules } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

/** @typedef {{ file: string, line: number, rule: string, message: string }} Violation */
const nodeModules = new Set(builtinModules.map(name => name.replace(/^node:/, '')));

/** @param {string} file @param {string} specifier @returns {string | undefined} */
export function importViolation(file, specifier) {
  const production = file.startsWith('client/') || file.startsWith('shared/');
  if (!production) return undefined;
  if (specifier.startsWith('.')) {
    const target = posix.normalize(posix.join(posix.dirname(file), specifier));
    const allowed = file.startsWith('shared/') ? ['shared/'] : ['client/', 'shared/'];
    if (!allowed.some(prefix => target.startsWith(prefix))) {
      return `Production imports must point inward; ${specifier} resolves to ${target}.`;
    }
    return undefined;
  }
  if (file.startsWith('shared/')) return 'Shared simulation code must not import runtime/framework packages.';
  if (specifier.startsWith('node:') || nodeModules.has(specifier)) return 'Browser code must not import Node built-ins.';
  if (specifier !== 'three' && !specifier.startsWith('three/')) {
    return `Undeclared client package boundary: ${specifier}. Review the policy when adding a dependency.`;
  }
  return undefined;
}

/** Small, explicit project rules; not a replacement for a full ESLint ruleset.
 * @param {string} file @param {string} text @returns {Violation[]}
 */
export function lintSource(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  /** @type {Violation[]} */
  const violations = [];
  /** @param {number} position @param {string} rule @param {string} message */
  const report = (position, rule, message) => violations.push({
    file, line: source.getLineAndCharacterOfPosition(position).line + 1, rule, message,
  });
  /** @param {import('typescript').Node} node */
  const visit = node => {
    if (ts.isDebuggerStatement(node)) report(node.getStart(source), 'no-debugger', 'Remove debugger statements.');
    if (ts.isVariableDeclarationList(node) && !(node.flags & ts.NodeFlags.BlockScoped)) {
      report(node.getStart(source), 'no-var', 'Use block-scoped const or let.');
    }
    if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && ts.isIdentifier(node.expression)
      && ['eval', 'Function'].includes(node.expression.text)) {
      report(node.getStart(source), 'no-dynamic-code', 'Do not evaluate dynamically constructed code.');
    }
    /** @type {import('typescript').Expression | undefined} */
    let specifier;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      specifier = node.moduleReference.expression;
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      if (ts.isStringLiteral(node.argument.literal)) specifier = node.argument.literal;
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
      specifier = node.arguments[0];
    }
    if (specifier) {
      if (ts.isStringLiteralLike(specifier)) {
        const reason = importViolation(file, specifier.text);
        if (reason) report(node.getStart(source), 'architecture', reason);
      } else if (file.startsWith('shared/') || file.startsWith('client/')) {
        report(node.getStart(source), 'architecture', 'Production dynamic imports must use literal paths.');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  // Scan comment tokens, not source text: examples inside test strings are not suppressions.
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if ((token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia)
      && /@ts-(ignore|nocheck)\b/.test(scanner.getTokenText())) {
      report(scanner.getTokenPos(), 'no-typecheck-bypass', 'Fix the type error; use an explained @ts-expect-error only in negative tests.');
    }
  }
  return violations;
}

/** @param {string} directory @returns {string[]} */
function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|mts|mjs|js)$/.test(entry.name) ? [path] : [];
  }).sort();
}

/** @param {string} root @returns {number} */
export function lintProject(root) {
  const files = ['client', 'shared', 'scripts', 'tests'].flatMap(dir => sourceFiles(join(root, dir)));
  files.push(join(root, 'vite.config.ts'), join(root, 'playwright.config.ts'));
  // Public compiler API for syntax checking; semantic checking remains `tsc --noEmit`.
  const program = ts.createProgram(files, {
    allowJs: true, noEmit: true, noResolve: true, noLib: true,
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  });
  const syntaxErrors = program.getSyntacticDiagnostics();
  if (syntaxErrors.length) {
    console.error(ts.formatDiagnosticsWithColorAndContext(syntaxErrors, {
      getCurrentDirectory: () => root, getCanonicalFileName: path => path, getNewLine: () => '\n',
    }));
  }
  const violations = files.flatMap(file => lintSource(relative(root, file).replaceAll('\\', '/'), readFileSync(file, 'utf8')));
  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line} [${violation.rule}] ${violation.message}`);
  }
  console.log(`Checked ${files.length} JS/TS files: ${violations.length} rule violations, ${syntaxErrors.length} syntax errors.`);
  return violations.length || syntaxErrors.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  process.exitCode = lintProject(root);
}
