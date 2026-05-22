export interface Chapter {
  bookId: string;
  title: string;
  content?: any;
  status: "draft" | "published";
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}
