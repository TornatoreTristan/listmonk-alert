import DatabaseService from './database.service';
import NotifierService from './notifier.service';
import StateService from './state.service';
import type { MonitorConfig } from '../types/config.types';
import type { NotificationData } from '../types/notification.types';
import logger from '../utils/logger';

class MonitorService {
  private databaseService: DatabaseService;
  private notifierService: NotifierService;
  private stateService: StateService;
  private config: MonitorConfig;
  private isRunning: boolean = false;
  private shouldStop: boolean = false;

  constructor(
    databaseService: DatabaseService,
    notifierService: NotifierService,
    stateService: StateService,
    config: MonitorConfig
  ) {
    this.databaseService = databaseService;
    this.notifierService = notifierService;
    this.stateService = stateService;
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Monitor service is already running');
      return;
    }

    this.isRunning = true;
    this.shouldStop = false;

    logger.info(
      {
        pollIntervalMs: this.config.pollIntervalMs,
        batchSize: this.config.batchSize,
        initialWatermark: this.stateService.getWatermark(),
      },
      'Monitor service started'
    );

    await this.monitorLoop();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping monitor service...');
    this.shouldStop = true;

    // Wait for current iteration to complete
    while (this.isRunning) {
      await this.sleep(100);
    }

    logger.info('Monitor service stopped');
  }

  private async monitorLoop(): Promise<void> {
    while (!this.shouldStop) {
      try {
        await this.pollAndProcess();
      } catch (error) {
        logger.error({ error }, 'Error in monitor loop, will retry');
      }

      // Wait for next poll interval
      await this.sleep(this.config.pollIntervalMs);
    }

    this.isRunning = false;
  }

  private async pollAndProcess(): Promise<void> {
    const currentWatermark = this.stateService.getWatermark();

    try {
      // Query for new views
      const newViews = await this.databaseService.getNewViews(
        currentWatermark,
        this.config.batchSize
      );

      if (newViews.length === 0) {
        logger.debug({ watermark: currentWatermark }, 'No new views found');
        return;
      }

      logger.info(
        { count: newViews.length, watermark: currentWatermark },
        'Found new email views'
      );

      // Process each view
      for (const view of newViews) {
        try {
          await this.processView(view);

          // Update watermark after successful processing
          await this.stateService.updateWatermark(view.id);
        } catch (error) {
          logger.error(
            {
              error,
              viewId: view.id,
              subscriberEmail: view.subscriber_email,
              campaignName: view.campaign_name,
            },
            'Failed to process view, will retry in next iteration'
          );

          // Don't update watermark on failure, so we retry this view next time
          break;
        }
      }
    } catch (error) {
      logger.error({ error, watermark: currentWatermark }, 'Failed to query database');
      throw error;
    }
  }

  private async processView(view: any): Promise<void> {
    const notificationData: NotificationData = {
      subscriberName: view.subscriber_name || '',
      subscriberEmail: view.subscriber_email || 'unknown@example.com',
      campaignName: view.campaign_name || '',
      campaignSubject: view.campaign_subject || '',
      openedAt: view.created_at,
    };

    logger.debug(
      {
        viewId: view.id,
        subscriberEmail: notificationData.subscriberEmail,
        campaignName: notificationData.campaignName,
      },
      'Processing email view'
    );

    await this.notifierService.sendNotification(notificationData);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getStatus(): {
    isRunning: boolean;
    currentWatermark: number;
  } {
    return {
      isRunning: this.isRunning,
      currentWatermark: this.stateService.getWatermark(),
    };
  }
}

export default MonitorService;
