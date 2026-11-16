import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export const getRouter = () => createRouter({ routeTree, scrollRestoration: true });

declare module '@tanstack/react-router' {
  // Router's application type is local to this host, never imported by gallery consumers.
  // oxlint-disable-next-line typescript/consistent-type-definitions
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
