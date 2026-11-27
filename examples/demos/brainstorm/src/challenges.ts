import library from './challenges.json';

export type Challenge = (typeof library.categories)[number]['challenges'][number];
export const challengeCategories = library.categories;
export const challenges = challengeCategories.flatMap(category => category.challenges);
export const judgingRules = library.globalJudgingRules;
export const findChallenge = (id: string) => challenges.find(challenge => challenge.id === id)!;

/** Draw from the selected category without immediately repeating the current challenge. */
export const drawChallenge = (categoryId: string, currentId?: string, random = Math.random) => {
  const pool = categoryId
    ? (challengeCategories.find(category => category.id === categoryId)?.challenges ?? [])
    : challenges;
  const choices = pool.filter(challenge => challenge.id !== currentId);
  if (!choices.length) throw new Error('No challenges in this category.');
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))]!;
};

export const answerKey = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
