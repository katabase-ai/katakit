import { installWhisperWorker } from '../whisperWorker';

installWhisperWorker(self, new URL(/* @vite-ignore */ './onnx/', import.meta.url).href);
