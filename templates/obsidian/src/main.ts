import { ItemView, Plugin, WorkspaceLeaf } from 'obsidian';
import { createTextSession } from './session';

const VIEW_TYPE = 'katakit-text-starter-view';
const SAMPLE = 'A sample transcript line from Obsidian.';

class TextView extends ItemView {
  private session?: ReturnType<typeof createTextSession>;
  private subscriptions: { unsubscribe(): void }[] = [];

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return 'Katakit text starter';
  }

  async onOpen() {
    const session = createTextSession();
    this.session = session;
    this.contentEl.empty();
    this.contentEl.createEl('h2', { text: 'Katakit · supplied text' });
    const input = this.contentEl.createEl('textarea', {
      attr: { 'aria-label': 'Transcript line' },
    });
    input.value = SAMPLE;
    const add = this.contentEl.createEl('button', { text: 'Add line to Katakit' });
    const status = this.contentEl.createEl('p', { attr: { role: 'status' } });
    const output = this.contentEl.createDiv();
    output.createEl('h3', { text: 'Conversation turns' });
    const list = output.createEl('ul');

    const render = () => {
      list.empty();
      for (const turn of session.conversationTurns$.get()) {
        list.createEl('li', { text: turn.text });
      }
    };
    this.subscriptions.push(session.conversationTurns$.subscribe(render));
    add.addEventListener('click', () => {
      try {
        session.submit(input.value);
        status.setText('Line added locally. Nothing was saved to the vault.');
        render();
      } catch (error) {
        status.setText(error instanceof Error ? error.message : 'Unable to add line.');
      }
    });
    render();
  }

  async onClose() {
    for (const subscription of this.subscriptions) subscription.unsubscribe();
    this.subscriptions = [];
    this.session?.close();
    this.session = undefined;
  }
}

// Obsidian loads the plugin constructor from the default CommonJS export.
// oxlint-disable-next-line import/no-default-export
export default class KatakitTextStarter extends Plugin {
  async onload() {
    this.registerView(VIEW_TYPE, leaf => new TextView(leaf));
    this.addCommand({
      id: 'open-text-starter',
      name: 'Open Katakit text starter',
      callback: () => {
        void (async () => {
          const leaf = this.app.workspace.getLeaf(true);
          await leaf.setViewState({ type: VIEW_TYPE, active: true });
          await this.app.workspace.revealLeaf(leaf);
        })();
      },
    });
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }
}
