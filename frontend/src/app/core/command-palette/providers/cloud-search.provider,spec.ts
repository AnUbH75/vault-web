import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SearchResultDto } from '../../../models/dtos/SearchResultDto';
import { CloudService } from '../../../services/cloud.service';
import { PaletteItem } from '../command-palette.types';
import {
  CLOUD_SEARCH_MAX_RESULTS,
  CloudSearchProvider,
} from './cloud-search.provider';

function result(
  path: string,
  type: 'file' | 'folder' = 'file',
  mimeType: string | null = 'text/plain',
): SearchResultDto {
  return {
    name: path.split('/').pop() as string,
    path,
    type,
    size: type === 'file' ? 10 : undefined,
    mimeType: type === 'file' ? mimeType : null,
    lastModifiedAt: 0,
    score: 95,
  };
}

describe('CloudSearchProvider', () => {
  let cloudService: jasmine.SpyObj<CloudService>;
  let router: jasmine.SpyObj<Router>;
  let provider: CloudSearchProvider;

  beforeEach(() => {
    cloudService = jasmine.createSpyObj<CloudService>('CloudService', [
      'searchInFolder',
    ]);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    TestBed.configureTestingModule({
      providers: [
        { provide: CloudService, useValue: cloudService },
        { provide: Router, useValue: router },
      ],
    });
    provider = TestBed.inject(CloudSearchProvider);
  });

  function search(results: SearchResultDto[]): PaletteItem[] {
    cloudService.searchInFolder.and.returnValue(of(results));
    let items: PaletteItem[] = [];
    provider.search('rep').subscribe((value) => (items = value));
    return items;
  }

  it('waits for at least two characters before searching', () => {
    expect(provider.minQueryLength).toBe(2);
  });

  it('searches from the root with a small limit and without the global error page', () => {
    search([]);

    expect(cloudService.searchInFolder).toHaveBeenCalledWith(
      '/',
      'rep',
      CLOUD_SEARCH_MAX_RESULTS,
      true,
    );
  });

  it('maps results to palette items in the order returned', () => {
    const items = search([
      result('Documents/Reports/report.pdf', 'file', 'application/pdf'),
      result('report.txt'),
    ]);

    expect(items.map((item) => item.id)).toEqual([
      'cloud:Documents/Reports/report.pdf',
      'cloud:report.txt',
    ]);
    expect(items[0].title).toBe('report.pdf');
    expect(items[0].subtitle).toBe('/Documents/Reports');
    expect(items[1].subtitle).toBe('/');
  });

  it('chooses an icon by type and MIME type', () => {
    const items = search([
      result('Documents', 'folder'),
      result('a.png', 'file', 'image/png'),
      result('b.mp4', 'file', 'video/mp4'),
      result('c.mp3', 'file', 'audio/mpeg'),
      result('d.pdf', 'file', 'application/pdf'),
      result('e.bin', 'file', null),
    ]);

    expect(items.map((item) => item.icon)).toEqual([
      'pi pi-folder',
      'pi pi-image',
      'pi pi-video',
      'pi pi-volume-up',
      'pi pi-file-pdf',
      'pi pi-file',
    ]);
  });

  it('opens the containing folder when a file is selected', () => {
    search([result('Documents/Reports/report.pdf')])[0].run();

    expect(router.navigate).toHaveBeenCalledWith(['/cloud'], {
      queryParams: { path: 'Documents/Reports' },
    });
  });

  it('opens the folder itself when a folder is selected', () => {
    search([result('Documents/Reports', 'folder')])[0].run();

    expect(router.navigate).toHaveBeenCalledWith(['/cloud'], {
      queryParams: { path: 'Documents/Reports' },
    });
  });

  it('opens the Cloud root for a file in the root folder', () => {
    search([result('report.txt')])[0].run();

    expect(router.navigate).toHaveBeenCalledWith(['/cloud'], {});
  });

  it('passes request errors on so the palette can show an error group', () => {
    cloudService.searchInFolder.and.returnValue(
      throwError(() => new Error('boom')),
    );
    let failed = false;

    provider.search('rep').subscribe({ error: () => (failed = true) });

    expect(failed).toBeTrue();
  });
});
