export interface User {
  name: string;
  email: string;
  password: string;
  role: "user" | "admin" | "author";
  avatar: string;
  isAuthor: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
}
