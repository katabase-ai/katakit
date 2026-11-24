import { Input } from '@base-ui/react/input';
import { useState } from 'react';
import { splitLane } from './time';

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
    <section
      aria-label="Lane visibility"
      className="border-b border-zinc-800 bg-[#202125] px-4 py-3"
    >
      <Input
        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-white outline-none focus:border-teal-400"
        aria-label="Search observables"
        placeholder="Find an observable…"
        value={query}
        onValueChange={setQuery}
      />
      <div className="mt-2 grid max-h-28 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
        {[...groups].map(([group, names]) => (
          <fieldset key={group}>
            <legend className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              {group}
            </legend>
            {names.map(lane => (
              <label
                className="flex items-center gap-2 rounded px-1 py-1 font-mono text-xs text-zinc-300 hover:bg-zinc-800"
                key={lane}
              >
                <input
                  type="checkbox"
                  className="size-3.5 accent-teal-400"
                  checked={!hidden.has(lane)}
                  onChange={() => toggle(lane)}
                />
                {splitLane(lane).name}
              </label>
            ))}
          </fieldset>
        ))}
        {!matches.length && <p className="text-xs text-zinc-400">No matching observables.</p>}
      </div>
    </section>
  );
};
