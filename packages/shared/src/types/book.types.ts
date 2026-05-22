export interface Book {
  title: string;
  authorId: string;
  chapters: string[];
  genre: string;
  publishedYear: number;
  averageRating?: number;
  description?: string;
  coverImage?: string;
  createdBy: string;
  status: string;
  publishedAt: Date;
}
