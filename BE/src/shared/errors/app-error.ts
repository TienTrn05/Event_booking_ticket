export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Array<{ field: string; code: string }>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
