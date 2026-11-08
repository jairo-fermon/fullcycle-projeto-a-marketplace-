import ts from 'typescript';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../src/', import.meta.url));
const modules = ['catalog', 'orders', 'payments'];
const allowed = { catalog: [], orders: ['catalog'], payments: ['orders'] };
export function inspect(source, file) {
  const errors = []; const owner = modules.find(name => file.includes(`modules/${name}/`));
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  for (const node of ast.statements) {
    if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
    if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const imported = node.moduleSpecifier.text;
    const resolved = imported.startsWith('.') ? relative(root, resolve(dirname(resolve(root, file)), imported)).split(sep).join('/') : imported;
    const target = modules.find(name => resolved.startsWith(`modules/${name}/`));
    if (target && owner !== target) {
      if (!resolved.endsWith(`modules/${target}/index.js`)) errors.push(`Import privado: ${file} -> ${imported}`);
      if (owner && !allowed[owner].includes(target)) errors.push(`Dependência proibida: ${owner} -> ${target}`);
    }
  }
  if (owner) for (const other of modules.filter(name => name !== owner)) {
    if (new RegExp(`\\b(?:FROM|JOIN|UPDATE|INTO|TABLE|INDEX)\\s+${other}\\.`, 'i').test(source)) errors.push(`SQL atravessa módulo: ${file} -> ${other}`);
  }
  return errors;
}
function walk(directory) { return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(resolve(directory, entry.name)) : entry.name.endsWith('.ts') ? [resolve(directory, entry.name)] : []); }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = walk(root).flatMap(file => inspect(readFileSync(file, 'utf8'), relative(root, file).split(sep).join('/')));
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log('PASSOU: fronteiras públicas, direção de dependências e SQL por módulo.');
}
