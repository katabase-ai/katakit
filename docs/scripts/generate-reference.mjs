import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, SignatureKind, SymbolFlags } from 'typescript/unstable/sync';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packageRoot = join(root, 'pkgs/event-log');
const output = join(root, 'docs/pages/reference/plugins/event-log.md');

const requireType = (type, label) => {
  if (!type || type.isErrorType()) throw new Error(`Unable to resolve ${label}`);
  return type;
};

const onlyCall = (checker, type, label) => {
  const signatures = checker.getSignaturesOfType(type, SignatureKind.Call);
  if (signatures.length !== 1) throw new Error(`Expected one call signature for ${label}`);
  return signatures[0];
};

const property = (checker, type, name, label) => {
  const found = checker.getPropertiesOfType(type).find(item => item.name === name);
  if (!found) throw new Error(`Missing ${label}.${name}`);
  return found;
};

const description = (symbol, checker, label) => {
  const value = symbol.getDocumentationComment(checker).trim();
  if (!value) throw new Error(`Missing JSDoc for ${label}`);
  return value;
};

const parameter = (checker, signature, label) => {
  const params = signature.getParameters();
  if (params.length !== 1) throw new Error(`Expected one parameter for ${label}`);
  return requireType(checker.getTypeOfSymbol(params[0]), `${label} parameter`);
};

const fields = (checker, type, label) => {
  const result = checker.getPropertiesOfType(type);
  if (!result.length) throw new Error(`No ${label} fields found`);
  return result.map(item => {
    const value = requireType(checker.getTypeOfSymbol(item), `${label}.${item.name}`);
    return `- \`${item.name}: ${checker.typeToString(value)}\` — ${description(item, checker, `${label}.${item.name}`)}`;
  });
};

const callbackResult = (checker, configured, name) => {
  const callback = property(checker, configured, name, 'configured plugin');
  const call = onlyCall(checker, requireType(checker.getTypeOfSymbol(callback), name), name);
  return requireType(checker.getReturnTypeOfSignature(call), `${name} result`);
};

export const renderReference = () => {
  const metadata = JSON.parse(readFileSync(join(packageRoot, 'docs/reference.json'), 'utf8'));
  const context = readFileSync(join(packageRoot, 'docs/reference.md'), 'utf8').trim();
  const api = new API();
  try {
    const snapshot = api.updateSnapshot({ openProjects: [join(packageRoot, 'tsconfig.json')] });
    const project = snapshot.getProject(join(packageRoot, 'tsconfig.json'));
    if (!project) throw new Error('Unable to open event-log TypeScript project');
    const { checker, program } = project;
    const entry = program.getSourceFile(join(packageRoot, 'src/index.ts'));
    if (!entry) throw new Error('Missing public package entry point');
    const moduleSymbol = checker.getSymbolAtLocation(entry);
    if (!moduleSymbol) throw new Error('Missing public package exports');
    const exports = checker.getExportsOfModule(moduleSymbol);
    const names = exports.map(item => item.name);
    if (new Set(metadata.exports).size !== names.length || !names.every(name => metadata.exports.includes(name))) {
      throw new Error(`Metadata exports do not match ${metadata.package}: ${names.join(', ')}`);
    }

    const sections = [];
    for (const symbol of exports) {
      const declaration = symbol.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      const factory = onlyCall(
        checker,
        requireType(checker.getTypeOfSymbolAtLocation(symbol, entry), symbol.name),
        symbol.name
      );
      const input = parameter(checker, factory, symbol.name);
      const plugin = requireType(checker.getReturnTypeOfSignature(factory), symbol.name);
      const configure = property(checker, plugin, 'configure', symbol.name);
      const configureCall = onlyCall(
        checker,
        requireType(checker.getTypeOfSymbol(configure), 'configure'),
        'configure'
      );
      const configureInput = parameter(checker, configureCall, 'configure');
      const configured = requireType(checker.getReturnTypeOfSignature(configureCall), 'configured plugin');
      const observables = callbackResult(checker, configured, 'observables');
      const methods = callbackResult(checker, configured, 'methods');
      const typeParams = factory.getTypeParameters().map(type => checker.typeToString(type));
      const typeArgs = typeParams.length ? `<${typeParams.join(', ')}>` : '';
      sections.push(
        `## ${symbol.name}\n\n${description(declaration, checker, symbol.name)}\n\n` +
          `\`import { ${symbol.name} } from '${metadata.package}'\`\n\n` +
          `\`\`\`text\n${symbol.name}${typeArgs}(options: ${checker.typeToString(input)}): ${checker.typeToString(plugin)}\n\`\`\`\n\n` +
          `### Factory options\n\n${fields(checker, input, `${symbol.name} options`).join('\n')}\n\n` +
          `### Configuration\n\n\`${symbol.name}(...).configure(options)\` accepts:\n\n` +
          `${fields(checker, configureInput, 'configure options').join('\n')}\n\n` +
          `### Observables\n\nAfter registration, access these with \`getObservables(${metadata.pluginName})\`:\n\n` +
          `${fields(checker, observables, 'observables').join('\n')}\n\n` +
          `### Methods\n\nAfter \`start()\`, access these with \`getMethods(${metadata.pluginName})\`:\n\n` +
          `${fields(checker, methods, 'methods').join('\n')}`
      );
    }

    return (
      `# ${metadata.title}\n\n` +
      `<!-- Generated by docs/scripts/generate-reference.mjs. Edit pkgs/event-log/src and pkgs/event-log/docs instead. -->\n\n` +
      `${context}\n\n${sections.join('\n\n')}\n\n` +
      metadata.related.map(item => `[${item.label}](${item.href})`).join(' · ') +
      '\n'
    );
  } finally {
    api.close();
  }
};

export const generateReference = ({ check = false } = {}) => {
  const content = renderReference();
  if (check) {
    if (readFileSync(output, 'utf8') !== content) {
      throw new Error(`${relative(root, output)} is stale; run pnpm --filter @katakit/docs reference:generate`);
    }
  } else {
    writeFileSync(output, content);
  }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateReference({ check: process.argv.includes('--check') });
}
