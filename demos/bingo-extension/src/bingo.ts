export const defaultSquares = [
  'Quick question',
  'Circle back',
  'Can you hear me',
  'Next steps',
  'One more thing',
  'On the same page',
  'Let me share',
  'A little context',
  'Good point',
  'Follow up',
  'Before we start',
  'Make sense',
  'Free space',
  'Let us revisit',
  'Any questions',
  'Action item',
  'Take this offline',
  'To be clear',
  'Sounds good',
  'Moving forward',
  'Timeline',
  'Just to clarify',
  'We have time',
  'I agree',
  'Thanks everyone',
];

export const normalize = (text: string) =>
  text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export const matchPhrase = (phrase: string, transcript: string) => {
  const needle = normalize(phrase);
  return !!needle && ` ${normalize(transcript)} `.includes(` ${needle} `);
};

export const parseSquares = (text: string) => {
  const phrases = text
    .split(/\r?\n/)
    .map(value => value.trim())
    .filter(Boolean);
  if (phrases.length !== 24) return undefined;
  phrases.splice(12, 0, 'Free space');
  return phrases;
};

export const winningLines = (marked: boolean[]) => {
  const lines: number[][] = [];
  for (let row = 0; row < 5; row++)
    lines.push(Array.from({ length: 5 }, (_, col) => row * 5 + col));
  for (let col = 0; col < 5; col++)
    lines.push(Array.from({ length: 5 }, (_, row) => row * 5 + col));
  lines.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return lines.filter(line => line.every(index => marked[index]));
};
