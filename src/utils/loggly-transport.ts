// loggly-transport.ts
import build from 'pino-abstract-transport';
import https from 'https';

interface LogglyTransportOptions {
  token: string;
  subdomain?: string;
  tags?: string[];
  batchSize?: number;
  flushInterval?: number;
}

interface LogObject {
  level: number;
  time: number;
  pid: number;
  hostname: string;
  msg?: string;
  err?: any;
  req?: any;
  res?: any;
  [key: string]: any;
}

interface LogglyLogData {
  timestamp: string;
  level: number;
  level_name: string;
  hostname: string;
  pid: number;
  msg: string;
  [key: string]: any;
}

const LOGGLY_ENDPOINT = 'https://logs-01.loggly.com/inputs';

const LEVEL_NAMES: Record<number, string> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

class LogglyBatcher {
  private batch: LogglyLogData[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private url: string,
    private batchSize: number = 10,
    private flushInterval: number = 5000,
  ) {}

  add(logData: LogglyLogData): void {
    this.batch.push(logData);

    if (this.batch.length >= this.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  private async flush(): Promise<void> {
    if (this.batch.length === 0) return;

    const logsToSend = [...this.batch];
    this.batch = [];

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    try {
      await this.sendBatch(logsToSend);
    } catch (_error) {
      void _error; // Explicitly ignore the error
      // Silently fail for logging transport to avoid circular logging issues
      // console.error('Failed to send batch to Loggly:', error)
    }
  }

  private sendBatch(logs: LogglyLogData[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const postData = logs.map((log) => JSON.stringify(log)).join('\n');
      const urlObj = new URL(this.url);

      const options: https.RequestOptions = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async destroy(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.flush();
  }
}

function transformLogObject(obj: LogObject): LogglyLogData {
  const { level, time, pid, hostname, msg, err, req, res, ...rest } = obj;

  const logData: LogglyLogData = {
    timestamp: new Date(time).toISOString(),
    level,
    level_name: LEVEL_NAMES[level] || 'info',
    hostname,
    pid,
    msg: msg || 'Log message',
    ...rest,
  };

  // Add error details if present
  if (err) {
    logData.error = {
      message: err.message,
      stack: err.stack,
      type: err.constructor?.name,
    };
  }

  // Add request details if present
  if (req) {
    logData.request = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      remoteAddress: req.remoteAddress,
      userAgent: req.headers?.['user-agent'],
    };
  }

  // Add response details if present
  if (res) {
    logData.response = {
      statusCode: res.statusCode,
      headers: res.headers,
    };
  }

  return logData;
}

// Export as a module that can be loaded by Pino
export = async function logglyTransport(opts: LogglyTransportOptions) {
  const { token, subdomain: _subdomain, tags = [], batchSize = 10, flushInterval = 5000 } = opts;

  if (!token) {
    throw new Error('Loggly token is required');
  }

  const url = `${LOGGLY_ENDPOINT}/${token}/tag/${tags.join(',')}/`;
  const batcher = new LogglyBatcher(url, batchSize, flushInterval);

  const transport = build(async function (source) {
    for await (const obj of source) {
      try {
        const logData = transformLogObject(obj as LogObject);
        batcher.add(logData);
      } catch (_err) {
        void _err; // Explicitly ignore the error
        // Silently fail for logging transport to avoid circular logging issues
        // console.error('Failed to process log for Loggly:', err)
      }
    }
  });

  // Cleanup on process exit
  const cleanup = () => batcher.destroy();
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('beforeExit', cleanup);

  return transport;
};
