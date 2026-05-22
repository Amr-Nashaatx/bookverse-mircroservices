export class AppError extends Error {
  status: string;
  constructor(msg: string, status: string) {
    super(msg);
    this.status = status;
  }
}
