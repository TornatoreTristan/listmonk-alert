import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger';

const STATE_FILE_PATH = '/data/state.json';

interface State {
  lastWatermark: number;
  lastUpdated: string;
}

class StateService {
  private watermark: number;
  private stateFilePath: string;

  constructor(initialWatermark: number = 0) {
    this.watermark = initialWatermark;
    this.stateFilePath = STATE_FILE_PATH;
  }

  async initialize(): Promise<void> {
    try {
      await this.loadFromFile();
      logger.info({ watermark: this.watermark }, 'State service initialized');
    } catch (error) {
      logger.warn(
        { error, initialWatermark: this.watermark },
        'Could not load state from file, using initial watermark'
      );
    }
  }

  getWatermark(): number {
    return this.watermark;
  }

  async updateWatermark(newWatermark: number): Promise<void> {
    if (newWatermark > this.watermark) {
      this.watermark = newWatermark;
      logger.debug({ watermark: this.watermark }, 'Watermark updated');

      // Persist asynchronously (fire and forget to not slow down processing)
      this.persistToFile().catch((error) => {
        logger.error({ error }, 'Failed to persist watermark to file');
      });
    }
  }

  private async loadFromFile(): Promise<void> {
    try {
      const data = await fs.readFile(this.stateFilePath, 'utf-8');
      const state: State = JSON.parse(data);

      if (state.lastWatermark && state.lastWatermark > this.watermark) {
        this.watermark = state.lastWatermark;
        logger.info(
          { watermark: this.watermark, lastUpdated: state.lastUpdated },
          'Watermark loaded from file'
        );
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.debug('State file does not exist, will be created on first update');
      } else {
        throw error;
      }
    }
  }

  async persistToFile(): Promise<void> {
    try {
      const state: State = {
        lastWatermark: this.watermark,
        lastUpdated: new Date().toISOString(),
      };

      // Ensure directory exists
      const dir = path.dirname(this.stateFilePath);
      await fs.mkdir(dir, { recursive: true });

      // Write state file
      await fs.writeFile(this.stateFilePath, JSON.stringify(state, null, 2), 'utf-8');

      logger.debug({ watermark: this.watermark }, 'Watermark persisted to file');
    } catch (error) {
      logger.error({ error }, 'Failed to persist state to file');
      throw error;
    }
  }
}

export default StateService;
