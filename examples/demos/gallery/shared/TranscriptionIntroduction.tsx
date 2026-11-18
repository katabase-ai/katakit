/** Local transcription needs no inference connection. Capture controls live in this demo. */
export const TranscriptionIntroduction = () => (
  <div className="gallery-transcription-introduction">
    <h1 id="title">Local transcription</h1>
    <p>
      Your browser turns microphone audio into text on this device. Start listening and speak
      naturally; each conversation turn appears below.
    </p>
  </div>
);

export const TranscriptionSetupComplete = () => (
  <p className="gallery-setup-complete" role="status">
    Your microphone and model are working. The model stays ready when you choose another demo.
  </p>
);
