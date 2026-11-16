import { Injectable } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import {
  ExternalDomainLink,
  resolveExternalLinkUrl,
} from '../../config/external-domains.config';

@Injectable({
  providedIn: 'root',
})
export class ExternalLinkService {
  constructor(private authService: AuthService) {}

  /** The link's URL, with the current token appended when the link asks for it. */
  urlFor(link: ExternalDomainLink): string {
    return resolveExternalLinkUrl(link, this.authService.getToken());
  }

  /** Refreshes the token, then opens the link with the fresh token. Falls back to the current token. */
  openWithFreshToken(link: ExternalDomainLink): void {
    this.authService.refresh().subscribe({
      next: (res) => {
        this.authService.saveToken(res.token);
        window.location.assign(resolveExternalLinkUrl(link, res.token));
      },
      error: () => {
        window.location.assign(this.urlFor(link));
      },
    });
  }

  /** Opens the link programmatically (no anchor click), as the command palette does. */
  open(link: ExternalDomainLink): void {
    if (!link.forwardVaultWebToken || !this.authService.getToken()) {
      window.location.assign(this.urlFor(link));
      return;
    }
    this.openWithFreshToken(link);
  }
}
