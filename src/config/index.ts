import dotenv from 'dotenv';
import { configSchema, ValidatedEnv } from './validation';
import type { AppConfig } from '../types/config.types';
import logger from '../utils/logger';

// Load environment variables
dotenv.config();

function loadAndValidateConfig(): AppConfig {
  try {
    // Validate environment variables
    const env: ValidatedEnv = configSchema.parse(process.env);

    // Transform to AppConfig
    const config: AppConfig = {
      database: {
        host: env.DB_HOST,
        port: env.DB_PORT,
        database: env.DB_NAME,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        ssl: env.DB_SSL,
      },
      googleChat: {
        webhookUrl: env.GOOGLE_CHAT_WEBHOOK_URL,
      },
      monitor: {
        pollIntervalMs: env.POLL_INTERVAL_MS,
        batchSize: env.BATCH_SIZE,
        initialWatermark: env.INITIAL_WATERMARK,
      },
      app: {
        env: env.NODE_ENV,
        healthCheckPort: env.HEALTH_CHECK_PORT,
        logLevel: env.LOG_LEVEL,
      },
      retry: {
        maxAttempts: env.RETRY_MAX_ATTEMPTS,
        delayMs: env.RETRY_DELAY_MS,
        backoffMultiplier: env.RETRY_BACKOFF_MULTIPLIER,
      },
    };

    logger.info('Configuration loaded and validated successfully');
    return config;
  } catch (error) {
    logger.error({ error }, 'Configuration validation failed');
    throw new Error(`Configuration validation failed: ${error}`);
  }
}

export const config = loadAndValidateConfig();
export default config;
