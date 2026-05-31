export class ApiResponse<T = unknown> {
    timestamp: string;

    constructor(
        public message: string,
        public data?: T,
    ) {
        this.timestamp = new Date().toISOString();
    }
}
