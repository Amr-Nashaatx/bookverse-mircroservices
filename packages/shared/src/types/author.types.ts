interface SocialLinks {
  website?: string;
  x?: string;
  instagram?: string;
  linkedIn?: string;
  facebook?: string;
}
export interface Author {
  penName: string;
  bio?: string;
  socialLinks?: SocialLinks;
  userId: string;
  isVerified: boolean;
  reviewdBy?: string;
  reviewdAt?: Date;
  rejectionReason?: string;
  status: "pending" | "approved" | "rejected";
}
