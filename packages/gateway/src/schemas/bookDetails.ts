import { Type } from '@fastify/type-provider-typebox';

export const BookPageParamsSchema = Type.Object({
    id: Type.String({ format: 'uuid' }),
});
