import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import * as v from 'valibot';

const ModelChoiceSchema = v.strictObject({
  model: v.pipe(v.string(), v.minLength(1)),
  upstream: v.optional(v.pipe(v.string(), v.minLength(1))),
});

const SavedCredentialSchema = v.variant('provider', [
  v.strictObject({
    provider: v.picklist(['openrouter', 'anthropic', 'openai', 'google', 'groq']),
    key: v.pipe(v.string(), v.minLength(1)),
  }),
  v.strictObject({ provider: v.literal('ollama') }),
  v.strictObject({
    provider: v.literal('custom'),
    endpoint: v.pipe(v.string(), v.url()),
    key: v.optional(v.pipe(v.string(), v.minLength(1))),
  }),
]);

/**
 * The developer's saved connection. It lives in the user's configuration directory, outside every
 * demo copy, so a commit in a copied demo cannot include it and every later copy reuses it.
 * Model choices are kept per provider so switching keys does not carry one provider's model ID
 * to another.
 */
const SavedInferenceSchema = v.strictObject({
  credential: v.optional(SavedCredentialSchema),
  models: v.optional(
    v.record(
      v.picklist(['openrouter', 'anthropic', 'openai', 'google', 'groq', 'ollama', 'custom']),
      ModelChoiceSchema
    )
  ),
});
export type SavedInference = v.InferOutput<typeof SavedInferenceSchema>;
export type SavedCredential = v.InferOutput<typeof SavedCredentialSchema>;

/** `$XDG_CONFIG_HOME/katakit` or `~/.config/katakit` on macOS and Linux; `%APPDATA%\katakit` on Windows. */
export const defaultInferenceFile = (
  environment: Record<string, string | undefined> = process.env
) => {
  const base =
    process.platform === 'win32'
      ? (environment.APPDATA ?? join(homedir(), 'AppData', 'Roaming'))
      : (environment.XDG_CONFIG_HOME ?? join(homedir(), '.config'));
  return join(base, 'katakit', 'inference.json');
};

/** A missing file is an empty configuration; an unreadable one is reported, never overwritten. */
export const readSavedInference = async (file: string): Promise<SavedInference> => {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
  const parsed = v.safeParse(SavedInferenceSchema, JSON.parse(text));
  if (!parsed.success) throw new Error(`${file} is not a valid Katakit inference file.`);
  return parsed.output;
};

/** Owner-only permissions: the file holds a development credential in plain text. */
export const writeSavedInference = async (file: string, value: SavedInference) => {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, `${JSON.stringify(v.parse(SavedInferenceSchema, value), null, 2)}\n`, {
    mode: 0o600,
  });
  await chmod(file, 0o600);
};
