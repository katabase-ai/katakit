import * as v from 'valibot';
import { NotesRequestError, NotesResultSchema, type Note } from './notesModel';

/**
 * Validate the response's shape, then apply what it can: a model that misuses an ID costs one
 * placement or correction, not the whole update. Copy existing notes so later corrections cannot
 * mutate previously recorded events.
 */
export const applyNotesResult = ({ notes, response }: { notes: Note[]; response: unknown }) => {
  const parsed = v.safeParse(NotesResultSchema, response);
  if (!parsed.success)
    throw new NotesRequestError('The model returned invalid notes.', {
      code: 'notes_schema',
    });

  const { additions, rewords } = parsed.output;
  // A reword for an ID that is not in the outline matches nothing here and is dropped.
  const reword = (note: Note['children'][number]) => ({
    ...note,
    text: rewords.find(change => change.id === note.id)?.text ?? note.text,
  });
  const updated = notes.map(note => ({
    ...reword(note),
    children: note.children.map(reword),
  }));
  for (const addition of additions) {
    // Short IDs are far easier for a model to copy back exactly than full UUIDs.
    const item = { id: crypto.randomUUID().slice(0, 8), text: addition.text };
    // The outline has two levels: detail aimed at a nested note joins that note's siblings. An
    // ID the outline does not contain, such as one invented for a note added in this same
    // response, keeps the text as a new top-level note rather than losing it.
    const parent =
      addition.underId === null
        ? undefined
        : updated.find(
            note =>
              note.id === addition.underId ||
              note.children.some(child => child.id === addition.underId)
          );
    if (parent) parent.children.push(item);
    else updated.push({ ...item, children: [] });
  }
  return updated;
};
