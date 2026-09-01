import rawEmojiData from 'unicode-emoji-json/data-by-group.json';
import emojiKeywords from 'emojilib';

export type EmojiCategoryId =
  | 'smileys'
  | 'people'
  | 'nature'
  | 'food'
  | 'activities'
  | 'objects'
  | 'symbols'
  | 'flags';

export interface EmojiEntry {
  char: string;
  name: string;
  keywords: string[];
  category: EmojiCategoryId;
}

export interface EmojiCategory {
  id: EmojiCategoryId;
  label: string;
  icon: string;
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  { id: 'smileys', label: 'Smileys', icon: '😀' },
  { id: 'people', label: 'People', icon: '🙌' },
  { id: 'nature', label: 'Nature', icon: '🌿' },
  { id: 'food', label: 'Food', icon: '🍔' },
  { id: 'activities', label: 'Activities', icon: '⚽' },
  { id: 'objects', label: 'Objects', icon: '💡' },
  { id: 'symbols', label: 'Symbols', icon: '❤️' },
  { id: 'flags', label: 'Flags', icon: '🏳️' },
];

const GROUP_TO_CATEGORY: Record<string, EmojiCategoryId> = {
  'Smileys & Emotion': 'smileys',
  'People & Body': 'people',
  'Animals & Nature': 'nature',
  'Food & Drink': 'food',
  'Travel & Places': 'objects',
  Activities: 'activities',
  Objects: 'objects',
  Symbols: 'symbols',
  Flags: 'flags',
};

interface RawEmoji {
  emoji: string;
  name: string;
}

interface RawEmojiGroup {
  name: string;
  slug: string;
  emojis: RawEmoji[];
}

function buildEmojiList(): EmojiEntry[] {
  const entries: EmojiEntry[] = [];
  const groups = rawEmojiData as RawEmojiGroup[];
  const keywords = emojiKeywords as Record<string, string[]>;

  for (const group of groups) {
    const category = GROUP_TO_CATEGORY[group.name];

    if (!category) {
      continue;
    }

    for (const emoji of group.emojis) {
      entries.push({
        char: emoji.emoji,
        name: emoji.name,
        keywords: keywords[emoji.emoji] ?? [],
        category,
      });
    }
  }

  return entries;
}

export const EMOJI_LIST: EmojiEntry[] = buildEmojiList();
