export interface Preview {
    id: string;
    bookId: string;
    userId: string;
    sharedBy: string;
    createdAt: Date;
    revokedAt?: Date;
    expiresAt?: Date;
}
