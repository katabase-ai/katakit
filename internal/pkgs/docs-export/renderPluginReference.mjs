import ts from 'typescript';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';

/**
 * Present concrete plugin contracts through the exporter's existing compiler, while retaining
 * TypeDoc's complete reference and anchors below the sections readers use to configure a plugin.
 */
export const renderPluginReference = ({ checker, symbol, source, markdown }) => {
  const signatures = checker.getSignaturesOfType(
    checker.getTypeOfSymbolAtLocation(symbol, source),
    ts.SignatureKind.Call
  );
  const signature = signatures.find(
    item => checker.getReturnTypeOfSignature(item).aliasSymbol?.name === 'KatakitPlugin'
  );
  if (!signature) return markdown;
  if (signatures.length !== 1)
    throw new Error(`${symbol.name}: expected one plugin factory signature`);
  const types = checker.getReturnTypeOfSignature(signature).aliasTypeArguments;
  if (types?.length !== 3)
    throw new Error(`${symbol.name}: unexpected KatakitPlugin type arguments`);
  // The generic constructor describes type parameters, not a particular plugin's public fields.
  if (types.some(type => type.flags & ts.TypeFlags.TypeParameter)) return markdown;
  const parameters = signature.getParameters();
  if (parameters.length !== 1)
    throw new Error(`${symbol.name}: expected one factory options object`);
  const options = checker.getTypeOfSymbolAtLocation(parameters[0], source);
  const format = type => checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation);
  const fields = (type, empty) => {
    const properties = checker.getPropertiesOfType(type);
    if (!properties.length) return empty;
    return properties
      .map(property => {
        const optional = property.flags & ts.SymbolFlags.Optional ? '?' : '';
        const type = checker.getTypeOfSymbolAtLocation(property, source);
        const description = ts.displayPartsToString(property.getDocumentationComment(checker));
        return `### ${property.name}\n\n\`\`\`ts\n${property.name}${optional}: ${format(type)}\n\`\`\`${description ? `\n\n${description}` : ''}`;
      })
      .join('\n\n');
  };
  const sections = [
    `## Factory options\n\nPass these fields to \`${symbol.name}(options)\`.\n\n${fields(options, 'No factory option fields.')}`,
    `## Configuration\n\nPass these fields to \`Plugin.configure(options)\` before registration.\n\n${fields(types[0], 'No configuration fields; pass `{}` to `configure`.')}`,
    `## Observables\n\nRead these through \`runtime.getObservables(Plugin)\`.\n\n${fields(types[1], 'This plugin exposes no observables.')}`,
    `## Methods\n\nAfter \`runtime.start()\`, call these through \`running.getMethods(Plugin)\`.\n\n${fields(types[2], 'This plugin exposes no methods.')}`,
  ].join('\n\n');

  const processor = remark().use(remarkGfm);
  const tree = processor.parse(markdown);
  const detailStart = tree.children.findIndex(node => node.type === 'heading' && node.depth === 2);
  if (detailStart < 0) throw new Error(`${symbol.name}: missing TypeDoc reference sections`);
  const introduction = tree.children.slice(0, detailStart);
  const details = tree.children.slice(detailStart);
  // The inferred return signature is useful for completeness, but too wide to be the introduction.
  const signatureIndex = introduction.findIndex(node => node.type === 'blockquote');
  if (signatureIndex >= 0) details.unshift(...introduction.splice(signatureIndex, 1));
  for (const node of details) {
    if (node.type === 'heading') node.depth = Math.min(6, node.depth + 1);
  }
  tree.children = [
    ...introduction,
    ...processor.parse(sections).children,
    ...processor.parse('## TypeScript reference').children,
    ...details,
  ];
  return processor.stringify(tree);
};
