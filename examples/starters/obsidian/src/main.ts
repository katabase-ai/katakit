import { ItemView, Plugin, WorkspaceLeaf } from 'obsidian';
import { createTextSession } from './session';
import { createShortClipTranscriber } from './speech';

const VIEW_TYPE = 'katakit-text-starter-view';

class TranscriptionView extends ItemView {
  private session?: ReturnType<typeof createTextSession>;
  private speech?: ReturnType<typeof createShortClipTranscriber>;
  private subscriptions: { unsubscribe(): void }[] = [];
  private recording = false;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return 'Katakit transcription starter';
  }

  async onOpen() {
    const session = createTextSession();
    this.session = session;
    this.contentEl.empty();
    this.contentEl.createEl('h2', { text: 'Local microphone transcript' });
    this.contentEl.createEl('p', {
      text: 'Record a short clip; Whisper Tiny downloads on first use. Audio stays on this device.',
    });
    const record = this.contentEl.createEl('button', { text: 'Record' });
    const status = this.contentEl.createEl('p', { attr: { role: 'status' } });
    const list = this.contentEl.createEl('ul');
    this.speech = createShortClipTranscriber({
      status: text => status.setText(text),
      final: session.acceptRecognized,
      error: text => {
        this.recording = false;
        record.setText('Record');
        status.setText(text);
      },
    });
    const render = () => {
      list.empty();
      for (const turn of session.turns$.get()) list.createEl('li', { text: turn.text });
    };
    this.subscriptions.push(session.turns$.subscribe(render));
    record.addEventListener('click', () => {
      record.disabled = true;
      void (async () => {
        try {
          if (this.recording) await this.speech?.stop();
          else await this.speech?.start();
          this.recording = !this.recording;
          record.setText(this.recording ? 'Stop' : 'Record');
        } catch (error) {
          this.recording = false;
          record.setText('Record');
          status.setText(error instanceof Error ? error.message : 'Recognition failed.');
        } finally {
          record.disabled = false;
        }
      })();
    });
    render();
  }

  async onClose() {
    await this.speech?.dispose();
    this.speech = undefined;
    this.recording = false;
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
    this.registerView(VIEW_TYPE, leaf => new TranscriptionView(leaf));
    this.addCommand({
      id: 'open-text-starter',
      name: 'Open Katakit transcription starter',
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
