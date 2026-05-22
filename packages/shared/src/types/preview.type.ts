export interface Preview {
  bookId: string;
  userId: string;
  sharedBy: string;
  createdAt: Date;
  revokedAt?: Date;
  expiresAt?: Date;
}
