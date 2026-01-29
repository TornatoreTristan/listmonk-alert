import dotenv from 'dotenv';
import DatabaseService from '../src/services/database.service';
import NotifierService from '../src/services/notifier.service';
import { configSchema } from '../src/config/validation';
import type { DatabaseConfig, GoogleChatConfig, RetryConfig } from '../src/types/config.types';

// Load environment variables
dotenv.config();

async function testConnections() {
  console.log('🔍 Testing Listmonk Alert connections...\n');

  // Validate environment variables
  console.log('📋 Step 1: Validating environment variables...');
  try {
    const env = configSchema.parse(process.env);
    console.log('✅ Environment variables validated successfully\n');

    // Test database connection
    console.log('📋 Step 2: Testing PostgreSQL connection...');
    const dbConfig: DatabaseConfig = {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      ssl: env.DB_SSL,
    };

    const dbService = new DatabaseService(dbConfig);
    await dbService.connect();

    const dbTest = await dbService.testConnection();
    if (dbTest.success) {
      console.log('✅ Database connection successful');
      console.log(`   Server time: ${dbTest.serverTime}\n`);

      // Try to fetch latest views
      console.log('📋 Step 3: Fetching latest campaign views...');
      const latestViews = await dbService.getLatestViews(5);
      console.log(`✅ Found ${latestViews.length} recent campaign views`);

      if (latestViews.length > 0) {
        console.log('\n   Latest views:');
        latestViews.forEach((view, index) => {
          console.log(`   ${index + 1}. ID: ${view.id}`);
          console.log(`      Email: ${view.subscriber_email}`);
          console.log(`      Campaign: ${view.campaign_name}`);
          console.log(`      Opened at: ${view.created_at}`);
          console.log('');
        });

        const highestId = Math.max(...latestViews.map(v => v.id));
        console.log(`💡 Suggestion: Set INITIAL_WATERMARK=${highestId} to start monitoring from now\n`);
      }

      await dbService.close();
    } else {
      console.log(`❌ Database connection failed: ${dbTest.error}\n`);
      process.exit(1);
    }

    // Test Google Chat webhook
    console.log('📋 Step 4: Testing Google Chat webhook...');
    const googleChatConfig: GoogleChatConfig = {
      webhookUrl: env.GOOGLE_CHAT_WEBHOOK_URL,
    };

    const retryConfig: RetryConfig = {
      maxAttempts: env.RETRY_MAX_ATTEMPTS,
      delayMs: env.RETRY_DELAY_MS,
      backoffMultiplier: env.RETRY_BACKOFF_MULTIPLIER,
    };

    const notifierService = new NotifierService(googleChatConfig, retryConfig);
    const webhookTest = await notifierService.testWebhook();

    if (webhookTest.success) {
      console.log('✅ Google Chat webhook test successful');
      console.log('   Check your Google Chat space for the test message\n');
    } else {
      console.log(`❌ Google Chat webhook test failed: ${webhookTest.error}\n`);
      process.exit(1);
    }

    console.log('🎉 All tests passed! Your configuration is ready.\n');
    console.log('Next steps:');
    console.log('  - Run "npm run dev" to start in development mode');
    console.log('  - Run "npm run build && npm start" for production mode');
    console.log('  - Or deploy with Docker using the provided Dockerfile\n');
  } catch (error: any) {
    console.error('❌ Configuration validation failed:');
    if (error.errors) {
      error.errors.forEach((err: any) => {
        console.error(`   - ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.error(`   ${error.message}`);
    }
    console.error('\nPlease check your .env file and try again.\n');
    process.exit(1);
  }
}

testConnections();
