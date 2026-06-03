export type BookStatus = 'draft' | 'published' | 'archived';

export interface Book {
    id: string;
    title: string;
    authorId: string;
    genre: Genre[];

    averageRating: number;
    ratingCount: number;

    description: string;
    coverImageUrl?: string;
    status: BookStatus;
    publishedAt: Date;

    createdAt: Date;
    updatedAt: Date;
}

export interface Genre {
    id: string;
    name: string;
}
