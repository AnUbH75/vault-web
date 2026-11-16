import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NEVER, defer, finalize, of, throwError } from 'rxjs';
import {
  ASYNC_PROVIDER_DEBOUNCE_MS,
  CommandPaletteService,
} from './command-palette.service';
import {
  PaletteGroup,
  PaletteItem,
  PaletteProvider,
} from './command-palette.types';

function item(id: string): PaletteItem {
  return { id, title: id, run: () => undefined };
}

function staticProvider(
  id: string,
  order: number,
  items: PaletteItem[],
  minQueryLength = 0,
): PaletteProvider {
  return {
    id,
    group: id,
    order,
    minQueryLength,
    search: jasmine.createSpy('search').and.returnValue(items),
  };
}

describe('CommandPaletteService', () => {
  let service: CommandPaletteService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CommandPaletteService);
  });

  function watch() {
    let latest: PaletteGroup[] = [];
    const subscription = service.groups$.subscribe((groups) => {
      latest = groups;
    });
    return { groups: () => latest, stop: () => subscription.unsubscribe() };
  }

  describe('registration', () => {
    it('shows a registered static provider on an empty query', () => {
      service.register(staticProvider('pages', 1, [item('p1')]));
      const { groups, stop } = watch();

      expect(groups().length).toBe(1);
      expect(groups()[0].title).toBe('pages');
      expect(groups()[0].items.map((i) => i.id)).toEqual(['p1']);
      expect(groups()[0].status).toBe('ready');
      stop();
    });

    it('orders groups by provider order', () => {
      service.register(staticProvider('b', 2, [item('b1')]));
      service.register(staticProvider('a', 1, [item('a1')]));
      const { groups, stop } = watch();

      expect(groups().map((g) => g.providerId)).toEqual(['a', 'b']);
      stop();
    });

    it('replaces a provider registered with the same id', () => {
      service.register(staticProvider('pages', 1, [item('old')]));
      service.register(staticProvider('pages', 1, [item('new')]));
      const { groups, stop } = watch();

      expect(groups().length).toBe(1);
      expect(groups()[0].items.map((i) => i.id)).toEqual(['new']);
      stop();
    });

    it('removes a provider with the returned unregister function', () => {
      const unregister = service.register(
        staticProvider('pages', 1, [item('p1')]),
      );
      const { groups, stop } = watch();
      expect(groups().length).toBe(1);

      unregister();

      expect(groups()).toEqual([]);
      stop();
    });

    it('does not let an old unregister remove a replacement', () => {
      const unregisterOld = service.register(
        staticProvider('pages', 1, [item('old')]),
      );
      service.register(staticProvider('pages', 1, [item('new')]));
      const { groups, stop } = watch();

      unregisterOld();

      expect(groups()[0].items.map((i) => i.id)).toEqual(['new']);
      stop();
    });

    it('hides a group whose provider returned no items', () => {
      service.register(staticProvider('empty', 1, []));
      service.register(staticProvider('pages', 2, [item('p1')]));
      const { groups, stop } = watch();

      expect(groups().map((g) => g.providerId)).toEqual(['pages']);
      stop();
    });
  });

  describe('minimum query length', () => {
    it('does not call a provider until the query is long enough', () => {
      const provider = staticProvider('cloud', 1, [item('c1')], 2);
      service.register(provider);
      const { groups, stop } = watch();

      expect(provider.search).not.toHaveBeenCalled();
      expect(groups()).toEqual([]);

      service.setQuery('r');
      expect(provider.search).not.toHaveBeenCalled();

      service.setQuery('re');
      expect(provider.search).toHaveBeenCalledWith('re');
      expect(groups().length).toBe(1);
      stop();
    });

    it('trims the query before checking its length and calling providers', () => {
      const provider = staticProvider('cloud', 1, [item('c1')], 2);
      service.register(provider);
      const { stop } = watch();

      service.setQuery('  r  ');
      expect(provider.search).not.toHaveBeenCalled();

      service.setQuery('  re  ');
      expect(provider.search).toHaveBeenCalledWith('re');
      stop();
    });
  });

  describe('async providers', () => {
    it('shows loading first, then results after the debounce', fakeAsync(() => {
      service.register({
        id: 'cloud',
        group: 'Cloud files',
        order: 3,
        minQueryLength: 2,
        search: () => of([item('c1')]),
      });
      const { groups, stop } = watch();

      service.setQuery('re');
      expect(groups()[0].status).toBe('loading');

      tick(ASYNC_PROVIDER_DEBOUNCE_MS);
      expect(groups()[0].status).toBe('ready');
      expect(groups()[0].items.map((i) => i.id)).toEqual(['c1']);
      stop();
    }));

    it('only subscribes once for rapid keystrokes', fakeAsync(() => {
      let subscribed = 0;
      service.register({
        id: 'cloud',
        group: 'Cloud files',
        order: 3,
        minQueryLength: 2,
        search: () =>
          defer(() => {
            subscribed++;
            return of([item('c1')]);
          }),
      });
      const { stop } = watch();

      service.setQuery('re');
      service.setQuery('rep');
      service.setQuery('repo');
      tick(ASYNC_PROVIDER_DEBOUNCE_MS);

      expect(subscribed).toBe(1);
      stop();
    }));

    it('cancels the in-flight request when the query changes', fakeAsync(() => {
      let subscribed = 0;
      let cancelled = 0;
      service.register({
        id: 'cloud',
        group: 'Cloud files',
        order: 3,
        minQueryLength: 2,
        search: () =>
          defer(() => {
            subscribed++;
            return NEVER.pipe(finalize(() => cancelled++));
          }),
      });
      const { stop } = watch();

      service.setQuery('re');
      tick(ASYNC_PROVIDER_DEBOUNCE_MS);
      expect(subscribed).toBe(1);
      expect(cancelled).toBe(0);

      service.setQuery('rep');
      expect(cancelled).toBe(1);

      tick(ASYNC_PROVIDER_DEBOUNCE_MS);
      expect(subscribed).toBe(2);
      stop();
    }));
  });

  describe('error isolation', () => {
    it('shows an error group for a failing async provider without affecting others', fakeAsync(() => {
      service.register(staticProvider('pages', 1, [item('p1')]));
      service.register({
        id: 'cloud',
        group: 'Cloud files',
        order: 3,
        minQueryLength: 2,
        search: () => throwError(() => new Error('boom')),
      });
      const { groups, stop } = watch();

      service.setQuery('re');
      tick(ASYNC_PROVIDER_DEBOUNCE_MS);

      expect(groups().map((g) => [g.providerId, g.status])).toEqual([
        ['pages', 'ready'],
        ['cloud', 'error'],
      ]);
      expect(groups()[0].items.map((i) => i.id)).toEqual(['p1']);
      stop();
    }));

    it('shows an error group when a provider throws synchronously', () => {
      service.register(staticProvider('pages', 1, [item('p1')]));
      service.register({
        id: 'broken',
        group: 'Broken',
        order: 2,
        minQueryLength: 0,
        search: () => {
          throw new Error('boom');
        },
      });
      const { groups, stop } = watch();

      expect(groups().map((g) => [g.providerId, g.status])).toEqual([
        ['pages', 'ready'],
        ['broken', 'error'],
      ]);
      stop();
    });
  });

  describe('open and close', () => {
    it('opens with an empty query', () => {
      service.setQuery('leftover');

      service.open();

      expect(service.isOpen).toBeTrue();
      expect(service.query).toBe('');
    });

    it('closes', () => {
      service.open();

      service.close();

      expect(service.isOpen).toBeFalse();
    });

    it('toggles between open and closed', () => {
      service.toggle();
      expect(service.isOpen).toBeTrue();

      service.toggle();
      expect(service.isOpen).toBeFalse();
    });
  });
});
