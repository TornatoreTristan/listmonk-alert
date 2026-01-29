import { z } from 'zod';

export const configSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  HEALTH_CHECK_PORT: z.string().transform(Number).pipe(z.number().int().positive()).default('3000'),

  // PostgreSQL
  DB_HOST: z.string().min(1, 'DB_HOST is required'),
  DB_PORT: z.string().transform(Number).pipe(z.number().int().positive()).default('5432'),
  DB_NAME: z.string().min(1, 'DB_NAME is required'),
  DB_USER: z.string().min(1, 'DB_USER is required'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),
  DB_SSL: z.string().transform((val) => val === 'true').default('true'),

  // Google Chat
  GOOGLE_CHAT_WEBHOOK_URL: z.string().url('GOOGLE_CHAT_WEBHOOK_URL must be a valid URL'),

  // Monitoring
  POLL_INTERVAL_MS: z.string().transform(Number).pipe(z.number().int().positive()).default('5000'),
  BATCH_SIZE: z.string().transform(Number).pipe(z.number().int().positive()).default('50'),
  INITIAL_WATERMARK: z.string().transform(Number).pipe(z.number().int().nonnegative()).default('0'),

  // Retry
  RETRY_MAX_ATTEMPTS: z.string().transform(Number).pipe(z.number().int().positive()).default('3'),
  RETRY_DELAY_MS: z.string().transform(Number).pipe(z.number().int().positive()).default('1000'),
  RETRY_BACKOFF_MULTIPLIER: z.string().transform(Number).pipe(z.number().positive()).default('2'),
});

export type ValidatedEnv = z.infer<typeof configSchema>;
