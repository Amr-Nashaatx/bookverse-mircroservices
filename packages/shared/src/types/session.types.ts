export interface Session {
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
}
