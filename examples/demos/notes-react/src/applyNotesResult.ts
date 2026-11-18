import * as v from 'valibot';
import { NotesRequestError, NotesResultSchema, type Note } from './notesModel';

/**
 * Validate the entire response before generating IDs or changing the outline.
 * Copy existing notes so later corrections cannot mutate previously recorded events.
 */
export const applyNotesResult = ({ notes, response }: { notes: Note[]; response: unknown }) => {
  const parsed = v.safeParse(NotesResultSchema, response);
  if (!parsed.success)
    throw new NotesRequestError('The model returned invalid notes. Try again.', {
      code: 'notes_schema',
    });

  const { additions, rewords } = parsed.output;
  const noteIds = notes.flatMap(note => [note.id, ...note.children.map(child => child.id)]);
  const missingParent = additions.some(
    addition => addition.underId !== undefined && !notes.some(note => note.id === addition.underId)
  );
  const missingReword = rewords.some(change => !noteIds.includes(change.id));
  if (missingParent || missingReword)
    throw new NotesRequestError('The model referred to a missing note. Try again.', {
      code: 'notes_target',
    });

  const reword = (note: Note['children'][number]) => ({
    ...note,
    text: rewords.find(change => change.id === note.id)?.text ?? note.text,
  });
  const updated = notes.map(note => ({
    ...reword(note),
    children: note.children.map(reword),
  }));
  for (const addition of additions) {
    const item = { id: crypto.randomUUID(), text: addition.text };
    if (addition.underId === undefined) updated.push({ ...item, children: [] });
    else updated.find(note => note.id === addition.underId)!.children.push(item);
  }
  return updated;
};
