import { defaultSquares, makeSquares, normalizePhrase } from './plugin';
import { worldCapitalTiers } from './worldCapitals';

type BingoPack = {
  id: string;
  label: string;
  /** Familiar, less familiar, and wildcard entries. A card draws eight from each. */
  tiers: readonly [readonly string[], readonly string[], readonly string[]];
};

export const bingoPacks = [
  {
    id: 'meeting',
    label: 'Meeting phrases',
    tiers: [
      defaultSquares.filter((_, index) => index < 12),
      defaultSquares.filter((_, index) => index > 12),
      [
        'Can everyone see my screen',
        'Let me jump in',
        'We are almost out of time',
        'Parking lot',
        'Hard stop',
        'For what it is worth',
        'You are on mute',
        'At a high level',
        'Take a step back',
        'I have to drop',
      ],
    ],
  },
  {
    id: 'animals',
    label: 'Animals',
    tiers: [
      [
        'Elephant',
        'Giraffe',
        'Penguin',
        'Dolphin',
        'Tiger',
        'Koala',
        'Panda',
        'Octopus',
        'Kangaroo',
        'Cheetah',
      ],
      [
        'Axolotl',
        'Capybara',
        'Narwhal',
        'Meerkat',
        'Platypus',
        'Wombat',
        'Pangolin',
        'Lemur',
        'Tapir',
        'Ocelot',
      ],
      [
        'Aye aye',
        'Quokka',
        'Okapi',
        'Kakapo',
        'Tardigrade',
        'Binturong',
        'Fossa',
        'Saiga',
        'Nudibranch',
        'Shoebill',
      ],
    ],
  },
  {
    id: 'us-states',
    label: 'US states',
    tiers: [
      [
        'California',
        'New York',
        'Texas',
        'Florida',
        'Hawaii',
        'Alaska',
        'Washington',
        'Colorado',
        'Arizona',
        'Nevada',
        'Illinois',
        'Pennsylvania',
        'Massachusetts',
        'New Jersey',
        'North Carolina',
        'Ohio',
        'Maryland',
      ],
      [
        'Oregon',
        'Georgia',
        'Michigan',
        'Virginia',
        'Tennessee',
        'Montana',
        'Maine',
        'Utah',
        'Louisiana',
        'Wisconsin',
        'Alabama',
        'Connecticut',
        'Indiana',
        'Iowa',
        'Kansas',
        'Kentucky',
        'Minnesota',
        'Mississippi',
        'Missouri',
        'New Mexico',
        'Oklahoma',
        'South Carolina',
      ],
      [
        'Wyoming',
        'Vermont',
        'Delaware',
        'Rhode Island',
        'Idaho',
        'Nebraska',
        'New Hampshire',
        'South Dakota',
        'Arkansas',
        'West Virginia',
        'North Dakota',
      ],
    ],
  },
  {
    id: 'world-capitals',
    label: 'World capitals',
    tiers: [
      worldCapitalTiers[0].map(([, capital]) => capital),
      worldCapitalTiers[1].map(([, capital]) => capital),
      worldCapitalTiers[2].map(([, capital]) => capital),
    ],
  },
  {
    id: 'tongue-twisters',
    label: 'Tricky to pronounce',
    tiers: [
      [
        'Squirrel',
        'Rural',
        'Anemone',
        'February',
        'Epitome',
        'Quinoa',
        'Yacht',
        'Colonel',
        'Aisle',
        'Genre',
      ],
      [
        'Worcestershire',
        'Onomatopoeia',
        'Chrysanthemum',
        'Otorhinolaryngology',
        'Anachronism',
        'Indictment',
        'Entrepreneur',
        'Eucalyptus',
        'Mnemonic',
        'Synecdoche',
      ],
      [
        'Floccinaucinihilipilification',
        'Sesquipedalian',
        'Antidisestablishmentarianism',
        'Sphygmomanometer',
        'Isthmus',
        'Pharaoh',
        'Rendezvous',
        'Cacophony',
        'Pulchritude',
        'Anemometer',
      ],
    ],
  },
  {
    id: 'corporate-jargon',
    label: 'Corporate jargon',
    tiers: [
      [
        'Circle back',
        'Touch base',
        'Bandwidth',
        'Synergy',
        'Deep dive',
        'Action item',
        'Next steps',
        'Low hanging fruit',
        'Take this offline',
        'Stakeholders',
      ],
      [
        'Move the needle',
        'Boil the ocean',
        'Single source of truth',
        'Value proposition',
        'Thought leadership',
        'North star',
        'Strategic alignment',
        'Key takeaways',
        'Double click',
        'Deliverables',
      ],
      [
        'Blue sky thinking',
        'Peel the onion',
        'Run it up the flagpole',
        'Eat our own dog food',
        'Paradigm shift',
        'Tiger team',
        'Take it to the next level',
        'Swim lanes',
        'Burning platform',
        'Disruptive innovation',
      ],
    ],
  },
  {
    id: 'ai-jargon',
    label: 'AI technical jargon',
    tiers: [
      [
        'Prompt',
        'Token',
        'Transformer',
        'Training data',
        'Inference',
        'Chatbot',
        'Neural network',
        'Machine learning',
        'Fine tuning',
        'Hallucination',
      ],
      [
        'Embedding',
        'Vector database',
        'Context window',
        'Retrieval augmented generation',
        'Attention mechanism',
        'Quantization',
        'Diffusion model',
        'Benchmark',
        'Open weights',
        'Multimodal',
      ],
      [
        'Mixture of experts',
        'LoRA',
        'Knowledge distillation',
        'Chain of thought',
        'Speculative decoding',
        'Gradient descent',
        'Overfitting',
        'Reinforcement learning',
        'Temperature scaling',
        'Agentic workflow',
      ],
    ],
  },
] as const satisfies readonly BingoPack[];

export type BingoPackId = (typeof bingoPacks)[number]['id'];

/** Balanced draw: eight entries per familiarity tier, then shuffle positions. */
export const drawBingoPack = (id: BingoPackId, random: () => number = Math.random) => {
  const pack = bingoPacks.find(item => item.id === id);
  if (!pack) throw new Error('Unknown bingo pack.');
  const shuffle = (items: string[]) => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [items[i], items[j]] = [items[j]!, items[i]!];
    }
    return items;
  };
  return makeSquares(shuffle(pack.tiers.flatMap(tier => shuffle([...tier]).slice(0, 8))));
};

/** Validation for curated packs; useful when adding new lists. */
export const validateBingoPacks = () =>
  bingoPacks.every(pack => {
    const phrases = pack.tiers.flat();
    return (
      pack.tiers.every(tier => tier.length >= 8) &&
      phrases.every(phrase => normalizePhrase(phrase)) &&
      new Set(phrases.map(normalizePhrase)).size === phrases.length
    );
  });
