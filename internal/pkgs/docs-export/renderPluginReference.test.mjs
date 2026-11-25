import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { renderPluginReference } from './renderPluginReference.mjs';

test('real plugin contracts expose inferred members, optional inputs and empty collections', () => {
  const directory = dirname(fileURLToPath(import.meta.url));
  const config = ts.readConfigFile(join(directory, 'tsconfig.reference.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, directory);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();
  const markdown =
    '# Function\n\n> Full inferred signature\n\n## Parameters\n\nOriginal parameters.\n\n## Returns\n\nOriginal linked return type.\n';
  const render = (packageName, name) => {
    const source = program.getSourceFile(
      join(directory, '../../../pkgs', packageName, 'src/index.ts')
    );
    const symbol = checker
      .getExportsOfModule(checker.getSymbolAtLocation(source))
      .find(symbol => symbol.name === name);
    return renderPluginReference({ checker, source, symbol, markdown });
  };

  const transcript = render('transcript-ingestion', 'makeTranscriptIngestionPlugin');
  assert.match(transcript, /collectedConversationTurns\$: WithProperty/);
  assert.match(transcript, /ingestUtterance: \(utterance: Utterance\) => void/);
  assert.match(transcript, /Stop the plugin's timer/);
  assert.match(transcript, /### Returns\n\nOriginal linked return type/);
  assert.ok(transcript.indexOf('## Methods') < transcript.indexOf('Full inferred signature'));

  const persistence = render('persistence', 'makeEventPersistencePlugin');
  assert.match(persistence, /appendEvents: \(events: KatakitEvent\[\]\) => void \| Promise<void>/);
  assert.match(persistence, /persistInterval\?: number \| undefined/);
  assert.match(persistence, /No configuration fields; pass `\{\}` to `configure`/);
  assert.match(persistence, /This plugin exposes no observables/);
  assert.match(persistence, /kill: \(\) => Promise<void>/);
  assert.doesNotMatch(persistence, /\.\.\./);

  assert.equal(render('core', 'makeKatakit'), markdown);
  assert.equal(render('core', 'makeKatakitPlugin'), markdown);
});
