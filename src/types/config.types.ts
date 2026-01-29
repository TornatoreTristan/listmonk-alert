export interface AppConfig {
  database: DatabaseConfig;
  googleChat: GoogleChatConfig;
  monitor: MonitorConfig;
  app: AppSettings;
  retry: RetryConfig;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

export interface GoogleChatConfig {
  webhookUrl: string;
}

export interface MonitorConfig {
  pollIntervalMs: number;
  batchSize: number;
  initialWatermark: number;
}

export interface AppSettings {
  env: string;
  healthCheckPort: number;
  logLevel: string;
}

export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
}
