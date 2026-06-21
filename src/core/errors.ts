import { Context } from 'hono';

export class AppError extends Error {
  public status: number;
  
  constructor(message: string, status: number = 400) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 422);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Global Hono error handler.
 */
export const errorHandler = (err: Error, c: Context) => {
  console.error(`[Error] ${err.name}: ${err.message}`);
  
  if (err instanceof AppError) {
    return c.json({
      success: false,
      error: err.message,
      type: err.name
    }, err.status as any);
  }

  // Fallback for unexpected system errors
  return c.json({
    success: false,
    error: err.message || 'An unexpected server error occurred',
    type: 'InternalServerError'
  }, 500);
};
