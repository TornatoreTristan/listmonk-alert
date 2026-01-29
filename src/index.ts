import config from './config';
import logger from './utils/logger';
import DatabaseService from './services/database.service';
import NotifierService from './services/notifier.service';
import StateService from './services/state.service';
import MonitorService from './services/monitor.service';
import HealthCheckServer from './server/health';

class Application {
  private databaseService: DatabaseService;
  private notifierService: NotifierService;
  private stateService: StateService;
  private monitorService: MonitorService;
  private healthServer: HealthCheckServer;

  constructor() {
    // Initialize services
    this.databaseService = new DatabaseService(config.database);
    this.notifierService = new NotifierService(config.googleChat, config.retry);
    this.stateService = new StateService(config.monitor.initialWatermark);
    this.monitorService = new MonitorService(
      this.databaseService,
      this.notifierService,
      this.stateService,
      config.monitor
    );
    this.healthServer = new HealthCheckServer({
      port: config.app.healthCheckPort,
      getWatermark: () => this.stateService.getWatermark(),
      isMonitorRunning: () => this.monitorService.getStatus().isRunning,
    });
  }

  async start(): Promise<void> {
    try {
      logger.info(
        {
          env: config.app.env,
          logLevel: config.app.logLevel,
        },
        'Starting Listmonk Alert application'
      );

      // Initialize state service
      await this.stateService.initialize();

      // Connect to database
      await this.databaseService.connect();

      // Start health check server
      await this.healthServer.start();

      // Start monitoring
      await this.monitorService.start();

      logger.info('Listmonk Alert application started successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to start application');
      await this.shutdown();
      process.exit(1);
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down gracefully...');

    try {
      // Stop monitoring first
      await this.monitorService.stop();

      // Persist final watermark
      await this.stateService.persistToFile();

      // Stop health server
      await this.healthServer.stop();

      // Close database connection
      await this.databaseService.close();

      logger.info('Shutdown complete');
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
    }
  }
}

// Create application instance
const app = new Application();

// Handle graceful shutdown
const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    logger.info({ signal }, 'Received shutdown signal');
    await app.shutdown();
    process.exit(0);
  });
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
  app.shutdown().then(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled rejection');
  app.shutdown().then(() => process.exit(1));
});

// Start application
app.start().catch((error) => {
  logger.error({ error }, 'Failed to start application');
  process.exit(1);
});
