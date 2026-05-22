export type BookStatus = 'draft' | 'published' | 'archived';

export interface Book {
    id: string;
    title: string;
    authorId: string;
    chapterIds: string[];
    genre: string;
    publishedYear: number;
    averageRating?: number;
    description?: string;
    coverImage?: string;
    createdBy: string;
    status: BookStatus;
    publishedAt: Date;
}
