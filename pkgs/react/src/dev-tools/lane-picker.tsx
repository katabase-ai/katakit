import { Input } from '@base-ui/react/input';
import { useState } from 'react';
import { splitLane } from './time';
import { ui } from './theme.generated';

export const LanePicker = ({
  lanes,
  hidden,
  toggle,
}: {
  lanes: string[];
  hidden: ReadonlySet<string>;
  toggle: (lane: string) => void;
}) => {
  const [query, setQuery] = useState('');
  const matches = lanes.filter(lane => lane.toLowerCase().includes(query.trim().toLowerCase()));
  const groups = new Map<string, string[]>();
  for (const lane of matches) {
    const group = splitLane(lane).group;
    const siblings = groups.get(group);
    if (siblings) siblings.push(lane);
    else groups.set(group, [lane]);
  }
  return (
    <section aria-label="Lane visibility" className={ui.filters}>
      <Input
        className={ui.search}
        aria-label="Search observables"
        placeholder="Find an observable…"
        value={query}
        onValueChange={setQuery}
      />
      <div className={ui.choices}>
        {[...groups].map(([group, names]) => (
          <fieldset key={group}>
            <legend className={ui.caption}>{group}</legend>
            {names.map(lane => (
              <label className={ui.choice} key={lane}>
                <input
                  type="checkbox"
                  className={ui.checkbox}
                  checked={!hidden.has(lane)}
                  onChange={() => toggle(lane)}
                />
                {splitLane(lane).name}
              </label>
            ))}
          </fieldset>
        ))}
        {!matches.length && <p className={ui.hint}>No matching observables.</p>}
      </div>
    </section>
  );
};
