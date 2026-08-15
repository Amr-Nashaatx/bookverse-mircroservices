import { ApiResponse, authenticateUser, ForbiddenError, ValidationError } from '@bookverse/shared';
import { bookService } from '../services/book.service.js';
import {
    BookListResponseSchema,
    BookResponseSchema,
    UpdateBookInput,
    UpdateBookSchema,
    CreateBookSchema,
    UpdateBookParamsSchema,
} from '../schemas/book.schemas.js';
import { FastifyTypeboxInstance } from '../types/fastify.js';
import crypto from 'node:crypto';

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

    fastify.post(
        '/',
        { preHandler: authenticateUser, schema: { response: { 201: BookResponseSchema }, body: CreateBookSchema } },
        async (request, reply) => {
            const authorId = request.user!.id;
            const body = request.body;
            const idempKey = request.headers['idempotency-key'] as string;

            if (!idempKey) throw new ValidationError('Idempotency key required');

            // put the body in a sorted form, so JSON.stringify produces same string before hash.
            const sorted = Object.entries(body).sort(([k1, _v1], [k2, _v2]) => k1.localeCompare(k2));

            // hash the request body as a fingerprint for this request
            const requestHash = crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex');

            const created = await bookService.createBook(authorId, body, idempKey, requestHash);

            const { book, replayed } = created;
            request.log.info({ replayed, idempKey }, 'book create');
            reply.status(201).send(new ApiResponse('Book created', book));
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
