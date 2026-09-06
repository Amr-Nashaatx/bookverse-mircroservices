import 'fastify';
import {
    FastifyInstance,
    RawServerDefault,
    RawRequestDefaultExpression,
    RawReplyDefaultExpression,
    FastifyBaseLogger,
} from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

declare module 'fastify' {
    interface FastifyRequest {
        user?: { id: string; role: string; email: string };
    }
}

export type FastifyTypeboxInstance = FastifyInstance<
    RawServerDefault,
    RawRequestDefaultExpression<RawServerDefault>,
    RawReplyDefaultExpression<RawServerDefault>,
    FastifyBaseLogger,
    TypeBoxTypeProvider
>;
