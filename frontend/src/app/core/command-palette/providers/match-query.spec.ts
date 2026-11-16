import { matchesQuery } from './match-query';

describe('matchesQuery', () => {
  it('matches everything for an empty or blank query', () => {
    expect(matchesQuery('', 'Cloud')).toBeTrue();
    expect(matchesQuery('   ', 'Cloud')).toBeTrue();
  });

  it('is case-insensitive', () => {
    expect(matchesQuery('CLOUD', 'cloud')).toBeTrue();
    expect(matchesQuery('cloud', 'CLOUD')).toBeTrue();
  });

  it('requires every word to match', () => {
    expect(matchesQuery('cloud trash', 'Cloud', 'Trash bin')).toBeTrue();
    expect(matchesQuery('cloud zebra', 'Cloud', 'Trash bin')).toBeFalse();
  });

  it('matches across fields', () => {
    expect(
      matchesQuery('login history', 'Security Activity', 'login', 'history'),
    ).toBeTrue();
  });

  it('ignores undefined fields', () => {
    expect(matchesQuery('cloud', undefined, 'Cloud')).toBeTrue();
    expect(matchesQuery('cloud', undefined)).toBeFalse();
  });
});
