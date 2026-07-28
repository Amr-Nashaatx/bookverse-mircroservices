import { ApiResponse, authenticateUser, ForbiddenError, UnauthorizedError } from '@bookverse/shared';
import { bookService } from '../services/book.service.js';
import {
    BookListResponseSchema,
    BookResponseSchema,
    CreateBookInput,
    UpdateBookInput,
    UpdateBookSchema,
    CreateBookSchema,
    UpdateBookParamsSchema,
} from '../schemas/book.schemas.js';
import { FastifyTypeboxInstance } from '../types/fastify.js';

export async function bookRoutes(fastify: FastifyTypeboxInstance) {
    /*
        PUBLIC (at the gateway): no user identity required.
        Still sits behind verifyGatewaySecret at the service — the gateway is the only caller.
        Input:  none
        Output: list of books
    */
    fastify.get('/', { schema: { response: { 200: BookListResponseSchema } } }, async (_request, reply) => {
        const books = await bookService.listBooks();
        reply.status(200).send(new ApiResponse('books fetched', books));
    });

    /*
        PUBLIC (at the gateway): fetch a single book by id.
        Input:  id (params)
        Output: book
    */
    fastify.get('/:id', { schema: { response: { 200: BookResponseSchema } } }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const book = await bookService.getBook(id);
        reply.status(200).send(new ApiResponse('book fetched', book));
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TODO(amr) — Lesson 02 build task. These are YOURS to wire; left out on purpose.
    //
    // POST '/'  — protected, any logged-in user.
    //   1. Add the MEDIUM layer: an `authenticateUser` preHandler (build it in
    //      @bookverse/shared) that reads x-user-id / x-user-role / x-user-email
    //      into request.user, and 401s if they're absent. Never default to
    //      anonymous / undefined.
    //   2. Attach it to THIS route only:  { preHandler: authenticateUser, schema: { body: CreateBookSchema, ... } }
    //   3. In the handler, use request.user.id as the trusted authorId:
    //         const book = await bookService.createBook(request.user.id, request.body);
    //      Do NOT read request.headers['x-user-id'] here — only request.user, set by the plugin.
    //
    // PATCH '/:id' — protected, OWNER ONLY (the FINE layer).
    //   Load the book, compare book.authorId to request.user.id, and reject
    //   non-owners. (You decided 403 here — because book existence is already
    //   public via GET.) This check lives in the service/route, NOT the gateway,
    //   because only this service owns the books table.
    //
    // You'll also register `authenticateUser`'s Fastify type augmentation
    // (declare module 'fastify' { interface FastifyRequest { user?: {...} } }).
    // ─────────────────────────────────────────────────────────────────────────

    fastify.post(
        '/',
        { preHandler: authenticateUser, schema: { response: { 201: BookResponseSchema }, body: CreateBookSchema } },
        async (request, reply) => {
            const authorId = request.user!.id;
            const bookData = request.body as CreateBookInput;

            const created = await bookService.createBook(authorId, bookData);
            reply.status(201).send(new ApiResponse('Book created', created));
        },
    );

    fastify.patch(
        '/:id',
        {
            preHandler: authenticateUser,
            schema: { response: { 200: BookResponseSchema }, body: UpdateBookSchema, params: UpdateBookParamsSchema },
        },
        async (request, reply) => {
            const authorId = request.user!.id;
            const { id: bookId } = request.params as { id: string };
            const bookUpdateData = request.body as UpdateBookInput;

            // ownership check
            const book = await bookService.getBook(bookId);
            if (book.authorId !== authorId) throw new ForbiddenError('You do not have permission for this action');

            const updated = await bookService.updateBook(bookId, bookUpdateData);
            reply.send(new ApiResponse('Book updated'));
        },
    );
}
