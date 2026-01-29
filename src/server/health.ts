import http from 'http';
import logger from '../utils/logger';

interface HealthCheckOptions {
  port: number;
  getWatermark: () => number;
  isMonitorRunning: () => boolean;
}

class HealthCheckServer {
  private server: http.Server | null = null;
  private options: HealthCheckOptions;

  constructor(options: HealthCheckOptions) {
    this.options = options;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (error) => {
        logger.error({ error }, 'Health check server error');
        reject(error);
      });

      this.server.listen(this.options.port, () => {
        logger.info({ port: this.options.port }, 'Health check server started');
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          logger.error({ error }, 'Error stopping health check server');
          reject(error);
        } else {
          logger.info('Health check server stopped');
          resolve();
        }
      });
    });
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url || '/';

    // Redirect root to /health
    if (url === '/') {
      res.writeHead(302, { Location: '/health' });
      res.end();
      return;
    }

    // Health check endpoint
    if (url === '/health') {
      const healthStatus = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        lastWatermark: this.options.getWatermark(),
        monitorRunning: this.options.isMonitorRunning(),
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(healthStatus, null, 2));
      return;
    }

    // 404 for other paths
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}

export default HealthCheckServer;
