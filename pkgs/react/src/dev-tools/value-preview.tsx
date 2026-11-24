import { Collapsible } from '@base-ui/react/collapsible';
import { useMemo, useState } from 'react';
import { fieldIndex, fieldValue, indexedLength, leafText } from './value-fields';
import { buttonClasses, ToolButton } from './ui';

const pageSize = 32;

// Only mounted inside an open disclosure. Index the keys once per opening;
// read descriptors for the visible page only, including for sparse arrays.
const Fields = ({
  object,
  length,
  ancestors,
}: {
  object: object;
  length: number | null;
  ancestors: readonly object[];
}) => {
  const fields = useMemo(() => fieldIndex(object, length), [object, length]);
  const [page, setPage] = useState(0);
  if (!fields) return <>[unavailable]</>;
  if (!fields.length) return <>Empty</>;
  const currentPage = Math.min(page, Math.ceil(fields.length / pageSize) - 1);
  const start = currentPage * pageSize;
  const end = Math.min(start + pageSize, fields.length);
  return (
    <>
      {Array.from({ length: end - start }, (_, i) => {
        const key = fields.keyAt(start + i);
        return (
          <ValueNode
            key={key}
            label={fields.indexed ? key : JSON.stringify(key)}
            value={fieldValue(object, key)}
            ancestors={ancestors}
          />
        );
      })}
      {fields.length > pageSize && (
        <div className="flex flex-wrap items-center gap-1 text-zinc-400">
          <ToolButton
            label="Previous fields"
            disabled={!start}
            onClick={() => setPage(currentPage - 1)}
          >
            ‹
          </ToolButton>
          <span aria-live="polite">
            {start + 1}–{end} of {fields.length}
          </span>
          <ToolButton
            label="Next fields"
            disabled={end === fields.length}
            onClick={() => setPage(currentPage + 1)}
          >
            ›
          </ToolButton>
        </div>
      )}
    </>
  );
};

const ValueNode = ({
  value,
  label,
  ancestors,
}: {
  value: unknown;
  label?: string;
  ancestors: readonly object[];
}) => {
  const prefix = label === undefined ? '' : `${label}: `;
  if (value === null || typeof value !== 'object')
    return (
      <div>
        {prefix}
        {leafText(value)}
      </div>
    );
  if (ancestors.includes(value)) return <div>{prefix}[circular]</div>;
  const length = indexedLength(value);
  if (length === undefined) return <div>{prefix}[unavailable]</div>;
  return (
    <Collapsible.Root defaultOpen={!ancestors.length}>
      <Collapsible.Trigger className={buttonClasses({ variant: 'disclosure' })}>
        <span
          aria-hidden="true"
          className="inline-block size-3 align-middle i-lucide-chevron-right"
        />
        {prefix}
        {length === null ? '{…}' : `Array(${length})`}
      </Collapsible.Trigger>
      <Collapsible.Panel className="ml-1.5 border-l border-zinc-700 pl-2">
        <Fields object={value} length={length} ancestors={[...ancestors, value]} />
      </Collapsible.Panel>
    </Collapsible.Root>
  );
};

export const ValuePreview = ({ value }: { value: unknown }) => (
  <div
    tabIndex={0}
    className="flex-1 overflow-auto whitespace-pre-wrap break-words pl-3 pr-11 py-2 font-mono text-[11px] leading-relaxed text-zinc-200"
  >
    <ValueNode value={value} ancestors={[]} />
  </div>
);
