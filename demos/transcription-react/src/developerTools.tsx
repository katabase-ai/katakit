import { context, trace } from '@opentelemetry/api';
import { StackContextManager, TracerProvider } from '@opentelemetry/sdk-trace';
import { createDevToolsStore, DevTools, type DevToolsProps } from '@katakit/react/dev-tools';
import '@katakit/react/dev-tools.css';

export const devToolsStore = createDevToolsStore({ scopeName: 'demo-transcription' });

// This entry is loaded only by the standalone development host. The gallery owns its own SDK.
export const installDeveloperCapture = () => {
  context.setGlobalContextManager(new StackContextManager().enable());
  trace.setGlobalTracerProvider(
    new TracerProvider({ spanProcessors: [devToolsStore.spanProcessor] })
  );
};

export const DeveloperWorkbench = (props: Omit<DevToolsProps, 'store'>) => (
  <DevTools {...props} store={devToolsStore} />
);
