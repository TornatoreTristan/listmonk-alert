import type { GoogleChatConfig, RetryConfig } from '../types/config.types';
import type {
  GoogleChatMessage,
  NotificationData,
} from '../types/notification.types';
import logger from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';

class NotifierService {
  private webhookUrl: string;
  private retryConfig: RetryConfig;

  constructor(googleChatConfig: GoogleChatConfig, retryConfig: RetryConfig) {
    this.webhookUrl = googleChatConfig.webhookUrl;
    this.retryConfig = retryConfig;
  }

  async sendNotification(data: NotificationData): Promise<void> {
    const message = this.formatMessage(data);

    await retryWithBackoff(
      async () => {
        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Google Chat webhook returned ${response.status}: ${errorText}`
          );
        }

        logger.info(
          {
            subscriberEmail: data.subscriberEmail,
            campaignName: data.campaignName,
          },
          'Notification sent successfully'
        );
      },
      {
        maxAttempts: this.retryConfig.maxAttempts,
        delayMs: this.retryConfig.delayMs,
        backoffMultiplier: this.retryConfig.backoffMultiplier,
        operationName: 'Send Google Chat notification',
      }
    );
  }

  private formatMessage(data: NotificationData): GoogleChatMessage {
    const formattedDate = this.formatDate(data.openedAt);
    const subscriberInfo = data.subscriberName
      ? `${data.subscriberName} (${data.subscriberEmail})`
      : data.subscriberEmail;

    return {
      cardsV2: [
        {
          card: {
            header: {
              title: '📧 Email ouvert',
              subtitle: 'Listmonk Alert',
            },
            sections: [
              {
                widgets: [
                  {
                    decoratedText: {
                      topLabel: 'Abonné',
                      text: subscriberInfo,
                    },
                  },
                  {
                    decoratedText: {
                      topLabel: 'Campagne',
                      text: data.campaignName || data.campaignSubject || 'Sans nom',
                    },
                  },
                  {
                    decoratedText: {
                      topLabel: 'Sujet',
                      text: data.campaignSubject || 'N/A',
                    },
                  },
                  {
                    decoratedText: {
                      topLabel: 'Ouverture',
                      text: formattedDate,
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    };
  }

  private formatDate(date: Date): string {
    const d = new Date(date);
    const day = d.getUTCDate().toString().padStart(2, '0');
    const month = d.toLocaleString('fr-FR', { month: 'short', timeZone: 'UTC' });
    const year = d.getUTCFullYear();
    const hours = d.getUTCHours().toString().padStart(2, '0');
    const minutes = d.getUTCMinutes().toString().padStart(2, '0');

    return `${day} ${month} ${year}, ${hours}:${minutes} UTC`;
  }

  async testWebhook(): Promise<{ success: boolean; error?: string }> {
    try {
      const testData: NotificationData = {
        subscriberName: 'Test User',
        subscriberEmail: 'test@example.com',
        campaignName: 'Test Campaign',
        campaignSubject: 'Test Subject',
        openedAt: new Date(),
      };

      await this.sendNotification(testData);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default NotifierService;
