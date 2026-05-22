export interface Shelf {
  user: string;
  name: string;
  description?: string;
  books: string[];
  createdAt: Date;
  updatedAt: Date;
}
