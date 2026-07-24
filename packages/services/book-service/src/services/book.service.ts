import { NotFoundError } from '@bookverse/shared';
import { bookRepository } from '../repositories/book.repository.js';
import type { Book } from '../generated/prisma/index.js';
import type { BookData, CreateBookInput } from '../schemas/book.schemas.js';

// Shape a Prisma Book (with Date objects) into the serializable response DTO.
function serialize(book: Book): BookData {
    return {
        id: book.id,
        title: book.title,
        authorId: book.authorId,
        genre: book.genre,
        description: book.description,
        coverImageUrl: book.coverImageUrl,
        status: book.status,
        publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
        createdAt: book.createdAt.toISOString(),
        updatedAt: book.updatedAt.toISOString(),
    };
}

export const bookService = {
    async listBooks(): Promise<BookData[]> {
        const books = await bookRepository.findBooks();
        return books.map(serialize);
    },

    async getBook(id: string): Promise<BookData> {
        const book = await bookRepository.findBookById(id);
        if (!book) throw new NotFoundError('book not found');
        return serialize(book);
    },

    /*
     * Creates a book owned by `authorId` (the authenticated caller).
     * The route layer is responsible for supplying a trusted authorId —
     * see the TODO in book.routes.ts. The service never reads headers.
     */
    async createBook(authorId: string, input: CreateBookInput): Promise<BookData> {
        const book = await bookRepository.createBook({
            title: input.title,
            description: input.description,
            genre: input.genre,
            coverImageUrl: input.coverImageUrl ?? null,
            authorId,
        });
        return serialize(book);
    },
};
