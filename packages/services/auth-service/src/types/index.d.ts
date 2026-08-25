import 'fastify';

declare module 'fastify' {
    interface FastifyRequest {
        // Added to the in-flight count, so onResponse knows to subtract it.
        counted: boolean;
    }
}
