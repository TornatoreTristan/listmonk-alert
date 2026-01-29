import logger from './logger';

export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
  operationName?: string;
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxAttempts, delayMs, backoffMultiplier, operationName = 'Operation' } = options;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        logger.error(
          { error: lastError, attempt, operationName },
          `${operationName} failed after ${maxAttempts} attempts`
        );
        throw lastError;
      }

      const currentDelay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
      logger.warn(
        { error: lastError, attempt, nextRetryInMs: currentDelay, operationName },
        `${operationName} failed, retrying...`
      );

      await sleep(currentDelay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
