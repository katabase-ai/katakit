/** Teach the actual shared controls rather than adding a second setup surface. */
export const TranscriptionIntroduction = () => (
  <div className="gallery-transcription-introduction">
    <p className="gallery-eyebrow">Start here</p>
    <h1 id="title">Speech recognition, on your device.</h1>
    <p>
      Your browser downloads a speech model, then turns microphone audio into text locally. Audio
      and transcripts stay in this browser.
    </p>
    <ol>
      <li>
        Choose a model in the <a href="#gallery-input">corner controls</a>, then start listening.
        The first start loads the model before asking for microphone access.
      </li>
      <li>Allow microphone access and say a few words. Your transcript will appear below.</li>
      <li>
        Once it works here, try another demo using the same controls. Your model stays ready; each
        demo gets a fresh conversation. Start the microphone again when you are ready.
      </li>
    </ol>
  </div>
);

/** Recognition provides visible confirmation before visitors move to another demo. */
export const TranscriptionSetupComplete = () => (
  <p className="gallery-setup-complete" role="status">
    Your microphone and model are working. Choose another demo from the menu; the corner controls
    stay with you.
  </p>
);
