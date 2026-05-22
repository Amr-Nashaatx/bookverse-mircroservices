export type ChapterStatus = 'draft' | 'published';

export interface Chapter {
    id: string;
    bookId: string;
    title: string;
    content?: Record<string, unknown>;
    status: ChapterStatus;
    wordCount: number;
    createdAt: Date;
    updatedAt: Date;
}
