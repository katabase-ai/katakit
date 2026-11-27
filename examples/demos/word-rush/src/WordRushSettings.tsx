import { useEffect, useRef, useState } from 'react';
import { challengeCategories } from './challenges';
import { Button, SelectField } from './controls';

type WordRushSettingsProps = {
  category: string;
  seconds: number | null;
  disabled: boolean;
  onApply: (category: string, seconds: number | null) => void;
};

const durationLabel = (seconds: number | null) =>
  seconds === null ? 'Unlimited' : seconds % 60 === 0 ? `${seconds / 60}min` : `${seconds}s`;

export const WordRushSettings = ({
  category,
  seconds,
  disabled,
  onApply,
}: WordRushSettingsProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draftCategory, setDraftCategory] = useState(category);
  const [draftSeconds, setDraftSeconds] = useState(seconds);

  useEffect(() => {
    if (disabled) dialog.current?.close();
  }, [disabled]);

  return (
    <>
      <div className="word-rush-settings-bar">
        <Button
          variant="border"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-controls="word-rush-settings-dialog"
          onClick={() => {
            setDraftCategory(category);
            setDraftSeconds(seconds);
            dialog.current?.showModal();
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M4 7h16M4 17h16" />
            <circle cx="9" cy="7" r="3" fill="var(--color-paper-2, Canvas)" />
            <circle cx="15" cy="17" r="3" fill="var(--color-paper-2, Canvas)" />
          </svg>
          Game settings
        </Button>
        <span>
          {challengeCategories.find(item => item.id === category)?.title ?? 'All categories'}
          {' · '}
          {durationLabel(seconds)}
        </span>
      </div>
      <dialog
        ref={dialog}
        id="word-rush-settings-dialog"
        className="word-rush-settings-dialog"
        aria-labelledby="word-rush-settings-title"
        aria-describedby="word-rush-settings-description"
      >
        <form
          onSubmit={event => {
            event.preventDefault();
            if (disabled) return;
            if (draftCategory !== category || draftSeconds !== seconds)
              onApply(draftCategory, draftSeconds);
            dialog.current?.close();
          }}
        >
          <h2 id="word-rush-settings-title">Game settings</h2>
          <p id="word-rush-settings-description">Changing settings prepares a fresh round.</p>
          <div className="word-rush-settings-fields">
            <SelectField
              id="word-rush-category"
              label="Category"
              value={draftCategory}
              onChange={event => setDraftCategory(event.target.value)}
            >
              <option value="">All categories</option>
              {challengeCategories.map(item => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </SelectField>
            <SelectField
              id="word-rush-duration"
              label="Round length"
              value={draftSeconds ?? 'unlimited'}
              onChange={event =>
                setDraftSeconds(
                  event.target.value === 'unlimited' ? null : Number(event.target.value)
                )
              }
            >
              <option value={30}>30s</option>
              <option value={60}>1min</option>
              <option value={120}>2min</option>
              <option value="unlimited">Unlimited</option>
            </SelectField>
          </div>
          <div className="word-rush-settings-actions">
            <Button variant="border" onClick={() => dialog.current?.close()}>
              Cancel
            </Button>
            <Button type="submit">Apply</Button>
          </div>
        </form>
      </dialog>
    </>
  );
};
