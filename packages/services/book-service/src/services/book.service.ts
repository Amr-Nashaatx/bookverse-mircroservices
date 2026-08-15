import { ConflictError, NotFoundError } from '@bookverse/shared';
import { bookRepository } from '../repositories/book.repository.js';
import type { Book } from '../generated/prisma/index.js';
import type { BookData, CreateBookInput, UpdateBookInput } from '../schemas/book.schemas.js';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { keyRepository } from '../repositories/key.repository.js';

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

type CreateBookOutcome = {
    replayed: boolean;
    book: BookData;
};
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
    async createBook(
        authorId: string,
        input: CreateBookInput,
        idempKey: string,
        requestHash: string,
    ): Promise<CreateBookOutcome> {
        try {
            const book = await bookRepository.createBook({ authorId, idempKey, requestHash, ...input });
            return { replayed: false, book: serialize(book) };
        } catch (e) {
            if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
                const key = (await keyRepository.findKeyByAuthorAndId(authorId, idempKey))!;

                // Same key, different request body. 422. The client has a bug — reusing a key for a different intent
                if (requestHash !== key.requestHash) throw new ConflictError('Invalid key reuse');

                // load the book for replay
                const book = await bookRepository.findBookById(key.bookId!);
                if (!book) throw new NotFoundError('Not found');
                // A successful create is always 201 — replaying it means replaying that.
                return { replayed: true, book: serialize(book) };
            }
            throw e;
        }
    },

    async updateBook(bookId: string, update: UpdateBookInput) {
        const updated = await bookRepository.updateBook(bookId, update);
        return serialize(updated);
    },
};
