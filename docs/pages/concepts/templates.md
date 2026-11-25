# Connect an input and a view

The [message-list plugin](plugins.md) exposes an action and a stream. A text form, a speech recognizer, or another input can call the action. A view subscribes to the stream. Neither needs to maintain a second copy of the message list.

## Display the list

Keep `eventLog.ts` and `messageList.ts`. For a plain browser view, add `<ul id="messages"></ul>` to your HTML and use this `main.ts`:

```ts
import { makeKatakit } from '@katakit/core';
import { MessageListPlugin } from './messageList';

const running = makeKatakit({
  plugins: [MessageListPlugin.configure({})],
}).start();
const list = document.querySelector<HTMLUListElement>('#messages')!;
const subscription = running.getObservables(MessageListPlugin).messages$.subscribe(messages => {
  list.replaceChildren(
    ...messages.map(text => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    })
  );
});

const { addMessage } = running.getMethods(MessageListPlugin);
addMessage('Hello from the view');
// The list now contains one item: Hello from the view.

// Call this when your application removes the view.
export const removeMessageView = () => subscription.unsubscribe();
```

The example uses `textContent` so message text is displayed as text. In React, use [React-RxJS bindings](../reference/react.md#react-rxjs-bindings) to subscribe during the component's lifetime. Unsubscribing the view does not stop the runtime's effects or property subscriptions.

## Connect speech

Use [transcription utilities](../reference/transcription.md) to recognize audio. Their `onFinal` callback receives a finalized text segment; it can call the same `addMessage(segment.text)` method. Provisional text changes while recognition runs, so display it separately until it becomes final.

For conversation turns rather than individual recognition segments, adapt the recognizer callbacks to [transcript ingestion](../reference/plugins/transcript-ingestion.md). Its projections reconstruct pending and completed turns from the built-in event log.

## Choose a platform starter

The [Starters catalog](../starters/README.md) provides the permissions, model assets, input wiring, and controls for each host. Copy a starter using its README, then find these connections before replacing its behavior:

1. Where a final recognized segment enters `ingestSegment`.
2. Where a view subscribes to completed and provisional text.
3. Where Stop drains recognition and flushes the last turn.
4. Where closing the application releases capture, workers, and subscriptions.

Start with [React web](../starters/react-web.md), [Electron](../starters/electron.md), [Chrome extension](../starters/chrome-extension.md), or [Obsidian](../starters/obsidian.md). Each guide records its actual verification limits. The [MCP App](../starters/mcp-app.md) remains WIP. React Native has no dedicated starter yet.

You now have the complete path from an input method to a recorded event and an observable view. Use [Reference](../reference/README.md) when changing a plugin's configuration, storage behavior, or resource ownership.
