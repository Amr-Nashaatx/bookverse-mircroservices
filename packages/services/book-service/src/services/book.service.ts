import { ConflictError, NotFoundError, Page, toPage, toSkipTake } from '@bookverse/shared';
import { bookRepository } from '../repositories/book.repository.js';
import type { Book } from '../generated/prisma/index.js';
import type { BookData, CreateBookInput, ListBooksQuery, UpdateBookInput } from '../schemas/book.schemas.js';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { keyRepository } from '../repositories/key.repository.js';

// Shape a Prisma Book (with Date objects) into the serializable response DTO.
function serialize(book: Book): BookData {
    return {
        id: book.id,
        title: book.title,
        ownerUserId: book.ownerUserId,
        genre: book.genre,
        description: book.description,
        coverImageUrl: book.coverImageUrl,
        status: book.status,
        publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
        createdAt: book.createdAt.toISOString(),
        updatedAt: book.updatedAt.toISOString(),
    };
}

/* How far the pager counts before it says "500+". 50 pages at the default
 * limit — past that nobody is reading, they are refining. */
const COUNT_CAP = 500;

type CreateBookOutcome = {
    replayed: boolean;
    book: BookData;
};
export const bookService = {
    /* Capped, so the count's cost does not grow with the table; parallel, so
     * it costs no wall-clock time. */
    async listBooks(query: ListBooksQuery): Promise<Page<BookData>> {
        const filters = { genre: query.genre, q: query.q };
        const pageQuery = { page: query.page, limit: query.limit, sort: query.sort, order: query.order };

        const { skip, take } = toSkipTake(pageQuery);
        const [rows, total] = await Promise.all([
            bookRepository.findBooks(filters, { skip, take, sort: pageQuery.sort, order: pageQuery.order }),
            bookRepository.countBooks(filters, COUNT_CAP),
        ]);

        return { ...toPage(rows.map(serialize), pageQuery), total, totalIsExact: total < COUNT_CAP };
    },

    async getBook(id: string): Promise<BookData> {
        const book = await bookRepository.findBookById(id);
        if (!book) throw new NotFoundError('book not found');
        return serialize(book);
    },

    /*
     * Creates a book owned by `ownerUserId` (the authenticated caller).
     * The route layer supplies that id from the verified identity; the service
     * never reads headers.
     */
    async createBook(
        ownerUserId: string,
        input: CreateBookInput,
        idempKey: string,
        requestHash: string,
    ): Promise<CreateBookOutcome> {
        try {
            const book = await bookRepository.createBook({ ownerUserId, idempKey, requestHash, ...input });
            return { replayed: false, book: serialize(book) };
        } catch (e) {
            if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
                const key = (await keyRepository.findKeyByOwnerAndId(ownerUserId, idempKey))!;

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
