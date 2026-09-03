import { FastifyInstance } from 'fastify';

const SHED_LOG_INTERVAL_MS = 5_000;

type LoadShedderState = {
    inFlight: number; // concurrent in flight requests
    shedTotal: number; // number of requests refused
    lastShedLogAt: number;
};

type ShedOptions = {
    exemptRoutes?: Set<string>;
    maxInFlightRequests: number;
};
export class LoadShedder {
    private state: LoadShedderState;
    constructor(
        private fastify: FastifyInstance,
        private options: ShedOptions,
    ) {
        this.state = { inFlight: 0, shedTotal: 0, lastShedLogAt: 0 };
        // Marks a request as counted, so the matching hook knows to subtract it again.
        this.fastify.decorateRequest('counted', false);
    }

    bindShedder() {
        this.fastify.addHook('onRequest', (req, reply, done) => {
            let countedReq = req as typeof req & { counted: boolean };

            // Incoming request should bypass the shedding
            if (this.options.exemptRoutes && this.options.exemptRoutes.has(countedReq.routeOptions.url ?? ''))
                return done();

            // Increment counter and mark it, so only the marked ones get decremented
            // later requests coming to an exempted route won't decrement an unincremented router
            this.state.inFlight += 1;
            countedReq.counted = true;

            // The counter already includes this request, so compare it directly.
            if (this.state.inFlight > this.options.maxInFlightRequests) {
                this.state.shedTotal += 1;

                const now = Date.now();
                if (now - this.state.lastShedLogAt >= SHED_LOG_INTERVAL_MS) {
                    this.state.lastShedLogAt = now;
                    req.log.warn(
                        {
                            inFlight: this.state.inFlight,
                            limit: this.options.maxInFlightRequests,
                            shedTotal: this.state.shedTotal,
                        },
                        'at capacity: refusing new work',
                    );
                }

                // Standard error envelope, worded so it can't read as a bad password.
                return reply
                    .status(503)
                    .header('retry-after', 1)
                    .send({ error: { message: 'We are busy right now. Please try again in a moment.' } });
            }

            done();
        });
        this.fastify.addHook('onResponse', (req, _reply, done) => {
            let countedReq = req as typeof req & { counted: boolean };

            if (countedReq.counted) this.state.inFlight -= 1;
            done();
        });
    }

    getStats() {
        return {
            inFlight: this.state.inFlight,
            limit: this.options.maxInFlightRequests,
            shedTotal: this.state.shedTotal,
        };
    }
}
