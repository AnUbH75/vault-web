import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map } from 'rxjs';
import { SearchResultDto } from '../../../models/dtos/SearchResultDto';
import { CloudService } from '../../../services/cloud.service';
import { PaletteItem, PaletteProvider } from '../command-palette.types';

/** Keeps Cloud results from crowding out the other groups. */
export const CLOUD_SEARCH_MAX_RESULTS = 8;

/** Folder path of an entry, relative to the user's root ('' for the root itself). */
function parentFolder(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

function iconFor(result: SearchResultDto): string {
  if (result.type === 'folder') {
    return 'pi pi-folder';
  }
  const mimeType = result.mimeType ?? '';
  if (mimeType.startsWith('image/')) {
    return 'pi pi-image';
  }
  if (mimeType.startsWith('video/')) {
    return 'pi pi-video';
  }
  if (mimeType.startsWith('audio/')) {
    return 'pi pi-volume-up';
  }
  if (mimeType === 'application/pdf') {
    return 'pi pi-file-pdf';
  }
  return 'pi pi-file';
}

@Injectable({
  providedIn: 'root',
})
export class CloudSearchProvider implements PaletteProvider {
  readonly id = 'cloud-files';
  readonly group = 'Cloud files';
  readonly order = 3;
  // The endpoint rejects blank queries and walks the whole tree, so wait for 2+ characters.
  readonly minQueryLength = 2;

  constructor(
    private cloudService: CloudService,
    private router: Router,
  ) {}

  search(query: string): Observable<PaletteItem[]> {
    // preserveErrorInPage: a failing search must show an error in this group,
    // not redirect the whole app to the global error page.
    return this.cloudService
      .searchInFolder('/', query, CLOUD_SEARCH_MAX_RESULTS, true)
      .pipe(map((results) => results.map((result) => this.toItem(result))));
  }

  private toItem(result: SearchResultDto): PaletteItem {
    const parent = parentFolder(result.path);
    // A folder opens itself; a file opens the folder that contains it.
    const folderToOpen = result.type === 'folder' ? result.path : parent;

    return {
      id: `cloud:${result.path}`,
      title: result.name,
      subtitle: `/${parent}`,
      icon: iconFor(result),
      run: () => {
        void this.router.navigate(
          ['/cloud'],
          folderToOpen ? { queryParams: { path: folderToOpen } } : {},
        );
      },
    };
  }
}
