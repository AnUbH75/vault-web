import { EMOJI_CATEGORIES, EMOJI_LIST } from './emoji-data';

describe('emoji-data', () => {
  it('exposes exactly the 8 categories required by the ticket', () => {
    const ids = EMOJI_CATEGORIES.map((c) => c.id);
    expect(ids).toEqual([
      'smileys',
      'people',
      'nature',
      'food',
      'activities',
      'objects',
      'symbols',
      'flags',
    ]);
    expect(new Set(ids).size).toBe(ids.length); // no duplicate category ids
  });

  it('builds a non-empty emoji list', () => {
    expect(EMOJI_LIST.length).toBeGreaterThan(0);
  });

  it('assigns every emoji a known category', () => {
    const validCategories = new Set(EMOJI_CATEGORIES.map((c) => c.id));
    expect(EMOJI_LIST.every((e) => validCategories.has(e.category))).toBe(true);
  });

  it('gives every emoji a non-empty character and name', () => {
    expect(EMOJI_LIST.every((e) => !!e.char && !!e.name)).toBe(true);
  });

  it('has no duplicate emoji characters', () => {
    const chars = EMOJI_LIST.map((e) => e.char);
    expect(new Set(chars).size).toBe(chars.length);
  });

  it('always gives every emoji a keywords array, even when emojilib has no entry', () => {
    expect(EMOJI_LIST.every((e) => Array.isArray(e.keywords))).toBe(true);
  });
});
