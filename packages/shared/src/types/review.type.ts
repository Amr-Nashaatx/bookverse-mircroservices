export interface Review {
  book: string;
  user: string;
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}
