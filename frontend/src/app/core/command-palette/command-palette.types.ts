import { Observable } from 'rxjs';

export interface PaletteItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  keywords?: string[];
  run: () => void;
}

/**
 * A source of palette items. Services register a provider so they can add
 * commands or search results without the palette component knowing about them.
 */
export interface PaletteProvider {
  id: string;
  group: string;
  order: number;
  minQueryLength: number;
  search(query: string): PaletteItem[] | Observable<PaletteItem[]>;
}

export type PaletteGroupStatus = 'ready' | 'loading' | 'error';

/** One group of results as the component renders it. */
export interface PaletteGroup {
  providerId: string;
  title: string;
  items: PaletteItem[];
  status: PaletteGroupStatus;
}
