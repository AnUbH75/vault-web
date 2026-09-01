import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { EmojiPickerComponent } from './emoji-picker.component';
import { EMOJI_LIST } from './emoji-data';

describe('EmojiPickerComponent', () => {
  let fixture: ComponentFixture<EmojiPickerComponent>;
  let component: EmojiPickerComponent;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [EmojiPickerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EmojiPickerComponent);
    component = fixture.componentInstance;
    component.storageKey = 'alice';
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('defaults to the smileys category when there are no recents', () => {
      expect(component.activeCategory).toBe('smileys');
      expect(component.visibleEmojis).toEqual(
        EMOJI_LIST.filter((e) => e.category === 'smileys'),
      );
    });

    it('focuses the search input on init', async () => {
      await fixture.whenStable();
      const searchInput = fixture.debugElement.query(
        By.css('input'),
      ).nativeElement;
      expect(document.activeElement).toBe(searchInput);
    });
  });

  describe('search', () => {
    it('filters by name (case-insensitive)', () => {
      component.searchQuery = 'GRINNING';
      fixture.detectChanges();

      expect(component.visibleEmojis.length).toBeGreaterThan(0);
      expect(
        component.visibleEmojis.every(
          (e) =>
            e.name.toLowerCase().includes('grinning') ||
            e.keywords.some((k) => k.toLowerCase().includes('grinning')),
        ),
      ).toBe(true);
      expect(
        component.visibleEmojis.some((e) =>
          e.name.toLowerCase().includes('grinning'),
        ),
      ).toBe(true);
    });

    it('falls back to keyword matches when the name does not match', () => {
      const target = EMOJI_LIST.find((e) => e.keywords.length > 0);
      if (!target) {
        return; // dataset provided no keywords in this environment
      }
      component.searchQuery = target.keywords[0];
      fixture.detectChanges();
      expect(component.visibleEmojis).toContain(target);
    });

    it('shows the empty state when nothing matches', () => {
      component.searchQuery = 'zzzznomatchzzzz';
      fixture.detectChanges();
      expect(component.visibleEmojis.length).toBe(0);
      expect(
        fixture.debugElement.query(By.css('.emoji-picker-empty')),
      ).toBeTruthy();
    });

    it('hides the category tabs while a search is active', () => {
      component.searchQuery = 'face';
      fixture.detectChanges();
      expect(
        fixture.debugElement.query(By.css('.emoji-picker-tabs')),
      ).toBeFalsy();
    });
  });

  describe('category selection', () => {
    it('switches the active category and clears any search query', () => {
      component.searchQuery = 'face';
      component.selectCategory('food');
      expect(component.activeCategory).toBe('food');
      expect(component.searchQuery).toBe('');
    });

    it('shows only recents when the recent pseudo-category is active', () => {
      const emoji = EMOJI_LIST[0];
      component.select(emoji);
      component.selectCategory('recent');
      expect(component.visibleEmojis).toEqual([emoji]);
    });
  });

  describe('selecting an emoji', () => {
    it('emits the selected character', () => {
      const emitSpy = spyOn(component.emojiSelected, 'emit');
      const emoji = EMOJI_LIST[0];
      component.select(emoji);
      expect(emitSpy).toHaveBeenCalledWith(emoji.char);
    });

    it('adds the emoji to recents, most-recent first', () => {
      const [first, second] = EMOJI_LIST;
      component.select(first);
      component.select(second);
      expect(component.recents[0]).toEqual(second);
      expect(component.recents[1]).toEqual(first);
    });

    it('de-duplicates recents, moving a re-selected emoji to the front', () => {
      const [first, second] = EMOJI_LIST;
      component.select(first);
      component.select(second);
      component.select(first);
      expect(component.recents[0]).toEqual(first);
      expect(
        component.recents.filter((e) => e.char === first.char).length,
      ).toBe(1);
    });

    it('caps recents at 24 entries', () => {
      EMOJI_LIST.slice(0, 30).forEach((e) => component.select(e));
      expect(component.recents.length).toBe(24);
    });

    it('persists recents to localStorage under a key namespaced by storageKey', () => {
      const emoji = EMOJI_LIST[0];
      component.select(emoji);
      const raw = localStorage.getItem('chat.emojiPicker.recents.alice');
      expect(raw).toBe(JSON.stringify([emoji.char]));
    });

    it('does not throw if localStorage.setItem fails', () => {
      spyOn(localStorage, 'setItem').and.throwError('quota exceeded');
      expect(() => component.select(EMOJI_LIST[0])).not.toThrow();
    });
  });

  describe('loading recents on init', () => {
    it('restores recents from localStorage and switches to the recent tab', () => {
      const [first, second] = EMOJI_LIST;
      localStorage.setItem(
        'chat.emojiPicker.recents.bob',
        JSON.stringify([second.char, first.char]),
      );

      const bobFixture = TestBed.createComponent(EmojiPickerComponent);
      bobFixture.componentInstance.storageKey = 'bob';
      bobFixture.detectChanges();

      expect(bobFixture.componentInstance.activeCategory).toBe('recent');
      expect(bobFixture.componentInstance.recents).toEqual([second, first]);
    });

    it('falls back to an empty list on malformed JSON', () => {
      localStorage.setItem('chat.emojiPicker.recents.corrupt', '{not json');

      const corruptFixture = TestBed.createComponent(EmojiPickerComponent);
      corruptFixture.componentInstance.storageKey = 'corrupt';
      expect(() => corruptFixture.detectChanges()).not.toThrow();
      expect(corruptFixture.componentInstance.recents).toEqual([]);
      expect(corruptFixture.componentInstance.activeCategory).toBe('smileys');
    });

    it('drops stored characters that no longer resolve to a known emoji', () => {
      localStorage.setItem(
        'chat.emojiPicker.recents.stale',
        JSON.stringify(['not-a-real-emoji', EMOJI_LIST[0].char]),
      );

      const staleFixture = TestBed.createComponent(EmojiPickerComponent);
      staleFixture.componentInstance.storageKey = 'stale';
      staleFixture.detectChanges();

      expect(staleFixture.componentInstance.recents).toEqual([EMOJI_LIST[0]]);
    });
  });

  describe('keyboard navigation', () => {
    function buttons(): HTMLButtonElement[] {
      return fixture.debugElement
        .queryAll(By.css('.emoji-picker-option'))
        .map((de) => de.nativeElement as HTMLButtonElement);
    }

    it('moves focus right/left with ArrowRight/ArrowLeft', () => {
      const els = buttons();
      els[0].focus();
      component.onGridKeydown(
        new KeyboardEvent('keydown', { key: 'ArrowRight' }),
        0,
      );
      expect(document.activeElement).toBe(els[1]);

      component.onGridKeydown(
        new KeyboardEvent('keydown', { key: 'ArrowLeft' }),
        1,
      );
      expect(document.activeElement).toBe(els[0]);
    });

    it('moves focus by a full row with ArrowDown/ArrowUp', () => {
      const els = buttons();
      component.onGridKeydown(
        new KeyboardEvent('keydown', { key: 'ArrowDown' }),
        0,
      );
      expect(document.activeElement).toBe(els[8]); // GRID_COLUMNS = 8

      component.onGridKeydown(
        new KeyboardEvent('keydown', { key: 'ArrowUp' }),
        8,
      );
      expect(document.activeElement).toBe(els[0]);
    });

    it('clamps at the first and last button instead of wrapping', () => {
      const els = buttons();
      component.onGridKeydown(
        new KeyboardEvent('keydown', { key: 'ArrowLeft' }),
        0,
      );
      expect(document.activeElement).toBe(els[0]);

      const lastIndex = els.length - 1;
      component.onGridKeydown(
        new KeyboardEvent('keydown', { key: 'ArrowRight' }),
        lastIndex,
      );
      expect(document.activeElement).toBe(els[lastIndex]);
    });

    it('ignores unrelated keys and does not call preventDefault', () => {
      const els = buttons();
      els[0].focus();
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      const preventSpy = spyOn(event, 'preventDefault');
      component.onGridKeydown(event, 0);
      expect(preventSpy).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(els[0]);
    });
  });
});
