export interface Shelf {
    id: string;
    userId: string;
    name: string;
    description?: string;
    bookIds: string[];
    createdAt: Date;
    updatedAt: Date;
}
