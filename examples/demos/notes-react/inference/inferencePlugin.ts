import { loadEnv, type Plugin } from 'vite';
import { createInferenceHandler } from './inferenceHandler';
import { defaultInferenceFile } from './savedInference';

/**
 * Give this demo a model connection while `vite dev` runs. The dev server holds the key and
 * forwards the demo's chat-completions requests, so the key never reaches the browser bundle.
 * It reads a key saved in the user's settings, then provider variables from the shell or
 * `.env.local`. Production builds do not include it.
 */
export const katakitInference = (): Plugin => ({
  name: 'katakit-inference',
  apply: 'serve',
  configureServer: server => {
    // An empty prefix loads every variable; Vite still exposes only `VITE_` ones to client code.
    const environment = loadEnv(server.config.mode, server.config.envDir || server.config.root, '');
    const inference = createInferenceHandler({
      environment,
      file: defaultInferenceFile(environment),
    });
    // Registered directly, so it runs before Vite's and other plugins' later middleware.
    server.middlewares.use((request, response, next) => {
      void inference.handle(request, response, next);
    });
    server.httpServer?.once('listening', async () => {
      server.config.logger.info(`  ➜  Model:   ${await inference.describeStartup()}`);
    });
  },
});
