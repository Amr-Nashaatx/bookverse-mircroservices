export interface AuthorSocialLinks {
    website?: string;
    x?: string;
    instagram?: string;
    linkedIn?: string;
    facebook?: string;
}
export type AuthorStatus = 'pending' | 'approved' | 'rejected';

export interface Author {
    id: string;
    penName: string;
    bio?: string;
    socialLinks?: AuthorSocialLinks;
    userId: string;
    isVerified: boolean;
    reviewdBy?: string;
    reviewdAt?: Date;
    rejectionReason?: string;
    status: AuthorStatus;
}
