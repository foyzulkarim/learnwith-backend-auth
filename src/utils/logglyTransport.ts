import { Transform } from 'stream';
import https from 'https';

interface LogglyConfig {
  token: string;
  subdomain: string;
  tags?: string[];
  host?: string;
}

export class LogglyTransport extends Transform {
  private config: LogglyConfig;
  private logglyUrl: string;

  constructor(config: LogglyConfig) {
    super({ objectMode: true });
    this.config = {
      host: 'logs-01.loggly.com',
      tags: ['nodejs', 'pino'],
      ...config,
    };

    this.logglyUrl = `https://${this.config.host}/inputs/${this.config.token}/tag/${this.config.tags!.join(',')}/`;
  }

  _transform(chunk: any, encoding: string, callback: (error?: Error | null) => void) {
    try {
      // Parse the log entry if it's a string
      const logEntry = typeof chunk === 'string' ? JSON.parse(chunk) : chunk;

      // Send to Loggly via HTTP
      this.sendToLoggly(logEntry)
        .then(() => {
          // Pass through the log entry to other transports
          this.push(chunk);
          callback();
        })
        .catch((error) => {
          console.error('Failed to send log to Loggly:', error.message);
          // Still pass through the log entry even if Loggly fails
          this.push(chunk);
          callback();
        });
    } catch (error) {
      console.error('Error processing log for Loggly:', error);
      this.push(chunk);
      callback();
    }
  }

  private async sendToLoggly(logEntry: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(logEntry);

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 5000, // 5 second timeout
      };

      const req = https.request(this.logglyUrl, options, (res) => {
        // Consume response data to free up memory
        res.on('data', () => {});
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`Loggly responded with status: ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Loggly request timeout'));
      });

      req.write(postData);
      req.end();
    });
  }
}

export function createLogglyTransport(config: LogglyConfig) {
  return new LogglyTransport(config);
}
