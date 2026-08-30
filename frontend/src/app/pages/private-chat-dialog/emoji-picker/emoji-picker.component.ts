import { CommonModule } from '@angular/common';
import {
  Component, ElementRef, EventEmitter, Input, OnInit,
  Output, ViewChild, ViewChildren, QueryList,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EMOJI_CATEGORIES, EMOJI_LIST, EmojiCategoryId, EmojiEntry } from './emoji-data';

const RECENTS_LIMIT = 24;
const RECENTS_STORAGE_PREFIX = 'chat.emojiPicker.recents.';
const GRID_COLUMNS = 8; // must match .emoji-picker-grid's grid-template-columns

@Component({
  selector: 'app-emoji-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './emoji-picker.component.html',
  styleUrls: ['./emoji-picker.component.scss'],
})
export class EmojiPickerComponent implements OnInit {
  /** Namespaces the recents list in localStorage — pass the current username. */
  @Input({ required: true }) storageKey!: string;
  @Output() emojiSelected = new EventEmitter<string>();

  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;
  @ViewChildren('emojiButton') emojiButtons!: QueryList<ElementRef<HTMLButtonElement>>;

  readonly categories = EMOJI_CATEGORIES;

  searchQuery = '';
  activeCategory: EmojiCategoryId | 'recent' = 'smileys';
  recents: EmojiEntry[] = [];

  private readonly emojiByChar = new Map(EMOJI_LIST.map((e) => [e.char, e]));

  ngOnInit(): void {
    this.recents = this.loadRecents();
    if (this.recents.length) {
      this.activeCategory = 'recent';
    }
    setTimeout(() => this.searchInputRef?.nativeElement.focus(), 0);
  }

  get visibleEmojis(): EmojiEntry[] {
    const query = this.searchQuery.trim().toLowerCase();

    if (query) {
      return EMOJI_LIST.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          e.keywords.some((k) => k.toLowerCase().includes(query)),
      );
    }

    return this.activeCategory === 'recent'
      ? this.recents
      : EMOJI_LIST.filter((e) => e.category === this.activeCategory);
  }

  selectCategory(id: EmojiCategoryId | 'recent'): void {
    this.activeCategory = id;
    this.searchQuery = '';
  }

  select(emoji: EmojiEntry): void {
    this.pushRecent(emoji);
    this.emojiSelected.emit(emoji.char);
  }

  onGridKeydown(event: KeyboardEvent, index: number): void {
    const buttons = this.emojiButtons.toArray();
    if (!buttons.length) return;

    let nextIndex = index;
    switch (event.key) {
      case 'ArrowRight': nextIndex = Math.min(index + 1, buttons.length - 1); break;
      case 'ArrowLeft': nextIndex = Math.max(index - 1, 0); break;
      case 'ArrowDown': nextIndex = Math.min(index + GRID_COLUMNS, buttons.length - 1); break;
      case 'ArrowUp': nextIndex = Math.max(index - GRID_COLUMNS, 0); break;
      default: return;
    }

    event.preventDefault();
    buttons[nextIndex].nativeElement.focus();
  }

  private pushRecent(emoji: EmojiEntry): void {
    this.recents = [emoji, ...this.recents.filter((e) => e.char !== emoji.char)]
      .slice(0, RECENTS_LIMIT);
    this.saveRecents();
  }

  private loadRecents(): EmojiEntry[] {
    try {
      const raw = localStorage.getItem(this.recentsKey());
      if (!raw) return [];
      const chars: string[] = JSON.parse(raw);
      return chars.map((c) => this.emojiByChar.get(c)).filter((e): e is EmojiEntry => !!e);
    } catch {
      return [];
    }
  }

  private saveRecents(): void {
    try {
      localStorage.setItem(this.recentsKey(), JSON.stringify(this.recents.map((e) => e.char)));
    } catch {
      // localStorage can be unavailable (private browsing, quota) — recents
      // are a nice-to-have, so fail silently rather than break the picker.
    }
  }

  private recentsKey(): string {
    return `${RECENTS_STORAGE_PREFIX}${this.storageKey}`;
  }
}
