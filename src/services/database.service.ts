import { Pool, QueryResult } from 'pg';
import type { DatabaseConfig } from '../types/config.types';
import type { EnrichedCampaignView } from '../types/database.types';
import logger from '../utils/logger';

class DatabaseService {
  private pool: Pool;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error({ error: err }, 'Unexpected error on idle PostgreSQL client');
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info(
        {
          host: this.config.host,
          database: this.config.database,
          user: this.config.user,
        },
        'Successfully connected to PostgreSQL'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to connect to PostgreSQL');
      throw error;
    }
  }

  async getNewViews(afterId: number, limit: number): Promise<EnrichedCampaignView[]> {
    const query = `
      SELECT
        cv.id,
        cv.campaign_id,
        cv.subscriber_id,
        cv.created_at,
        s.email as subscriber_email,
        s.name as subscriber_name,
        c.name as campaign_name,
        c.subject as campaign_subject
      FROM campaign_views cv
      LEFT JOIN subscribers s ON cv.subscriber_id = s.id
      LEFT JOIN campaigns c ON cv.campaign_id = c.id
      WHERE cv.id > $1
      ORDER BY cv.id ASC
      LIMIT $2;
    `;

    try {
      const result: QueryResult<EnrichedCampaignView> = await this.pool.query(query, [
        afterId,
        limit,
      ]);

      logger.debug(
        { afterId, limit, rowCount: result.rowCount },
        'Queried new campaign views'
      );

      return result.rows;
    } catch (error) {
      logger.error({ error, afterId, limit }, 'Failed to query new campaign views');
      throw error;
    }
  }

  async testConnection(): Promise<{
    success: boolean;
    serverTime?: Date;
    error?: string;
  }> {
    try {
      const result = await this.pool.query('SELECT NOW() as server_time');
      return {
        success: true,
        serverTime: result.rows[0].server_time,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getLatestViews(limit: number = 5): Promise<EnrichedCampaignView[]> {
    const query = `
      SELECT
        cv.id,
        cv.campaign_id,
        cv.subscriber_id,
        cv.created_at,
        s.email as subscriber_email,
        s.name as subscriber_name,
        c.name as campaign_name,
        c.subject as campaign_subject
      FROM campaign_views cv
      LEFT JOIN subscribers s ON cv.subscriber_id = s.id
      LEFT JOIN campaigns c ON cv.campaign_id = c.id
      ORDER BY cv.id DESC
      LIMIT $1;
    `;

    try {
      const result: QueryResult<EnrichedCampaignView> = await this.pool.query(query, [limit]);
      return result.rows;
    } catch (error) {
      logger.error({ error, limit }, 'Failed to query latest campaign views');
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      await this.pool.end();
      logger.info('Database connection pool closed');
    } catch (error) {
      logger.error({ error }, 'Error closing database connection pool');
      throw error;
    }
  }
}

export default DatabaseService;
