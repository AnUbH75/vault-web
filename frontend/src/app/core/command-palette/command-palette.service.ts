import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  catchError,
  combineLatest,
  isObservable,
  map,
  of,
  startWith,
  switchMap,
  timer,
} from 'rxjs';
import {
  PaletteGroup,
  PaletteGroupStatus,
  PaletteItem,
  PaletteProvider,
} from './command-palette.types';

/** How long to wait after the last keystroke before calling a backend provider. */
export const ASYNC_PROVIDER_DEBOUNCE_MS = 250;

@Injectable({
  providedIn: 'root',
})
export class CommandPaletteService {
  private readonly providersSubject = new BehaviorSubject<PaletteProvider[]>(
    [],
  );
  private readonly isOpenSubject = new BehaviorSubject<boolean>(false);
  private readonly querySubject = new BehaviorSubject<string>('');

  readonly isOpen$ = this.isOpenSubject.asObservable();
  readonly query$ = this.querySubject.asObservable();

  /**
   * Grouped results for the current query. Cold: nothing runs until someone
   * subscribes, so the component should subscribe only while the palette is open.
   * A new query cancels all in-flight provider requests.
   */
  readonly groups$: Observable<PaletteGroup[]> = combineLatest([
    this.querySubject,
    this.providersSubject,
  ]).pipe(
    switchMap(([query, providers]) => this.searchAll(query.trim(), providers)),
  );

  get isOpen(): boolean {
    return this.isOpenSubject.value;
  }

  get query(): string {
    return this.querySubject.value;
  }

  /**
   * Adds a provider. A provider with the same id replaces the existing one.
   * Returns a function that removes this provider again.
   */
  register(provider: PaletteProvider): () => void {
    const others = this.providersSubject.value.filter(
      (existing) => existing.id !== provider.id,
    );
    this.providersSubject.next(
      [...others, provider].sort((a, b) => a.order - b.order),
    );
    return () => {
      // Compare by instance so an older unregister cannot remove a replacement.
      this.providersSubject.next(
        this.providersSubject.value.filter((existing) => existing !== provider),
      );
    };
  }

  open(): void {
    this.querySubject.next('');
    this.isOpenSubject.next(true);
  }

  close(): void {
    this.isOpenSubject.next(false);
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  setQuery(query: string): void {
    this.querySubject.next(query);
  }

  private searchAll(
    query: string,
    providers: PaletteProvider[],
  ): Observable<PaletteGroup[]> {
    // Providers that need a longer query are not called at all (no request, no group).
    const active = providers.filter(
      (provider) => query.length >= provider.minQueryLength,
    );
    if (active.length === 0) {
      return of([]);
    }

    return combineLatest(
      active.map((provider) => this.searchProvider(provider, query)),
    ).pipe(
      // Hide groups that finished with nothing to show; keep loading and error groups.
      map((groups) =>
        groups.filter((g) => g.status !== 'ready' || g.items.length > 0),
      ),
    );
  }

  private searchProvider(
    provider: PaletteProvider,
    query: string,
  ): Observable<PaletteGroup> {
    const toGroup = (
      items: PaletteItem[],
      status: PaletteGroupStatus,
    ): PaletteGroup => ({
      providerId: provider.id,
      title: provider.group,
      items,
      status,
    });

    const result = this.safeSearch(provider, query);
    if (result === null) {
      return of(toGroup([], 'error'));
    }

    // Static providers answer immediately.
    if (!isObservable(result)) {
      return of(toGroup(result, 'ready'));
    }

    // Backend providers: wait for the debounce, then subscribe. If the query changes
    // first, the outer switchMap unsubscribes, which cancels both the timer and the
    // request. This relies on provider observables being cold (nothing happens until
    // subscribed), which is true for HttpClient.
    return timer(ASYNC_PROVIDER_DEBOUNCE_MS).pipe(
      switchMap(() => result),
      map((items) => toGroup(items, 'ready')),
      startWith(toGroup([], 'loading')),
      catchError(() => of(toGroup([], 'error'))),
    );
  }

  private safeSearch(
    provider: PaletteProvider,
    query: string,
  ): PaletteItem[] | Observable<PaletteItem[]> | null {
    try {
      return provider.search(query);
    } catch {
      return null;
    }
  }
}
