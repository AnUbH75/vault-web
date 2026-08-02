import { SharedResourceType } from './ResourceShareDto';

export interface SecureSendLinkDto {
  id: string;
  filePath: string;
  fileName: string;
  /** FILE for a single download, FOLDER for a browsable link. */
  resourceType?: SharedResourceType;
  shareUrl?: string;
  token?: string;
  expiresAt: string | Date;
  hasPassword?: boolean;
  isRevoked?: boolean;
  revokedAt?: string | Date | null;
  createdAt: string | Date;
}

/**
 * What the public landing page may know about a share before the password is
 * entered. A folder carries no size — that would mean walking the whole subtree.
 */
export interface PublicShareDto {
  fileName: string;
  sizeBytes: number;
  expiresAt: string;
  passwordProtected: boolean;
  resourceType: SharedResourceType;
}

export interface CreateSecureSendRequestDto {
  filePath: string;
  expiresAt: string;
  password?: string;
}
