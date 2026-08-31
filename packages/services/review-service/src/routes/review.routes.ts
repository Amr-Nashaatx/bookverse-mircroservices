import { ApiResponse, authenticateUser } from '@bookverse/shared';
import { reviewService } from '../services/review.service.js';
import {
    CreateReviewSchema,
    ListReviewsQuerySchema,
    ReviewListResponseSchema,
    ReviewParamsSchema,
    ReviewResponseSchema,
    UpdateReviewInput,
    UpdateReviewSchema,
} from '../schemas/review.schemas.js';
import { FastifyTypeboxInstance } from '../types/fastify.js';

export async function reviewRoutes(fastify: FastifyTypeboxInstance) {
    /*
        PUBLIC (at the gateway): no user identity required.
        Still sits behind verifyGatewaySecret at the service — the gateway is the only caller.
        Input:  bookId (query)
        Output: that book's reviews, newest first
    */
    fastify.get(
        '/',
        { schema: { querystring: ListReviewsQuerySchema, response: { 200: ReviewListResponseSchema } } },
        async (request, reply) => {
            const { bookId } = request.query as { bookId: string };
            const reviews = await reviewService.listReviewsForBook(bookId);
            reply.status(200).send(new ApiResponse('reviews fetched', reviews));
        },
    );

    /*
        PUBLIC (at the gateway): fetch a single review by id.
        Input:  id (params)
        Output: review
    */
    fastify.get(
        '/:id',
        { schema: { params: ReviewParamsSchema, response: { 200: ReviewResponseSchema } } },
        async (request, reply) => {
            const { id } = request.params as { id: string };
            const review = await reviewService.getReview(id);
            reply.status(200).send(new ApiResponse('review fetched', review));
        },
    );

    /*
        No idempotency key: the unique (bookId, userId) index means a repeated
        submit conflicts instead of duplicating, so the retry is already safe.
    */
    fastify.post(
        '/',
        { preHandler: authenticateUser, schema: { body: CreateReviewSchema, response: { 201: ReviewResponseSchema } } },
        async (request, reply) => {
            const userId = request.user!.id;
            const review = await reviewService.createReview(userId, request.body);
            reply.status(201).send(new ApiResponse('Review created', review));
        },
    );

    fastify.patch(
        '/:id',
        {
            preHandler: authenticateUser,
            schema: { params: ReviewParamsSchema, body: UpdateReviewSchema, response: { 200: ReviewResponseSchema } },
        },
        async (request, reply) => {
            const userId = request.user!.id;
            const { id } = request.params as { id: string };
            const update = request.body as UpdateReviewInput;

            const review = await reviewService.updateReview(id, userId, update);
            reply.status(200).send(new ApiResponse('Review updated', review));
        },
    );

    fastify.delete(
        '/:id',
        { preHandler: authenticateUser, schema: { params: ReviewParamsSchema } },
        async (request, reply) => {
            const userId = request.user!.id;
            const { id } = request.params as { id: string };

            await reviewService.deleteReview(id, userId);
            reply.status(204).send();
        },
    );
}
