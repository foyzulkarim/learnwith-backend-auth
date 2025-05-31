import fs from 'fs';
import path from 'path';

export interface LogRotationConfig {
  logDir: string;
  maxFileSize: number; // in bytes
  maxFiles: number; // number of files to keep
  maxAge: number; // max age in milliseconds
  filePattern: RegExp; // pattern to match log files
}

export class LogRotationManager {
  private config: LogRotationConfig;

  constructor(config?: Partial<LogRotationConfig>) {
    this.config = {
      logDir: path.join(process.cwd(), 'logs'),
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 7, // Keep 7 files
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      filePattern: /^app-\d{4}-\d{2}-\d{2}\.log$/, // Match app-YYYY-MM-DD.log
      ...config,
    };
  }

  /**
   * Clean up old log files based on age and count
   */
  async cleanupOldLogs(): Promise<void> {
    try {
      if (!fs.existsSync(this.config.logDir)) {
        return;
      }

      const files = fs.readdirSync(this.config.logDir);
      const logFiles = files
        .filter((file) => this.config.filePattern.test(file))
        .map((file) => {
          const filePath = path.join(this.config.logDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            path: filePath,
            size: stats.size,
            mtime: stats.mtime,
          };
        })
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // Sort by date, newest first

      const now = new Date();

      // Remove files older than maxAge
      const filesToDelete = logFiles.filter((file) => {
        const age = now.getTime() - file.mtime.getTime();
        return age > this.config.maxAge;
      });

      // Remove excess files (keep only maxFiles)
      if (logFiles.length > this.config.maxFiles) {
        const excessFiles = logFiles.slice(this.config.maxFiles);
        filesToDelete.push(...excessFiles);
      }

      // Delete the files
      for (const file of filesToDelete) {
        try {
          fs.unlinkSync(file.path);
          console.log(`🗑️  Cleaned up old log file: ${file.name} (${this.formatBytes(file.size)})`);
        } catch (error) {
          console.error(`❌ Failed to delete log file ${file.name}:`, error);
        }
      }

      if (filesToDelete.length === 0) {
        console.log('✅ No old log files to clean up');
      } else {
        console.log(`🧹 Cleaned up ${filesToDelete.length} old log files`);
      }

      // Report current log files
      const remainingFiles = logFiles.filter((file) => !filesToDelete.includes(file));
      if (remainingFiles.length > 0) {
        const totalSize = remainingFiles.reduce((sum, file) => sum + file.size, 0);
        console.log(
          `📁 Keeping ${remainingFiles.length} log files (${this.formatBytes(totalSize)} total)`,
        );
      }
    } catch (error) {
      console.error('❌ Error during log cleanup:', error);
    }
  }

  /**
   * Check if a log file needs rotation based on size
   */
  shouldRotateFile(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) {
        return false;
      }
      const stats = fs.statSync(filePath);
      return stats.size >= this.config.maxFileSize;
    } catch {
      return false;
    }
  }

  /**
   * Get log statistics
   */
  getLogStats(): {
    totalFiles: number;
    totalSize: number;
    oldestFile: Date | null;
    newestFile: Date | null;
  } {
    try {
      if (!fs.existsSync(this.config.logDir)) {
        return { totalFiles: 0, totalSize: 0, oldestFile: null, newestFile: null };
      }

      const files = fs.readdirSync(this.config.logDir);
      const logFiles = files
        .filter((file) => this.config.filePattern.test(file))
        .map((file) => {
          const filePath = path.join(this.config.logDir, file);
          const stats = fs.statSync(filePath);
          return { size: stats.size, mtime: stats.mtime };
        });

      if (logFiles.length === 0) {
        return { totalFiles: 0, totalSize: 0, oldestFile: null, newestFile: null };
      }

      const totalSize = logFiles.reduce((sum, file) => sum + file.size, 0);
      const dates = logFiles.map((file) => file.mtime);
      const oldestFile = new Date(Math.min(...dates.map((d) => d.getTime())));
      const newestFile = new Date(Math.max(...dates.map((d) => d.getTime())));

      return {
        totalFiles: logFiles.length,
        totalSize,
        oldestFile,
        newestFile,
      };
    } catch {
      return { totalFiles: 0, totalSize: 0, oldestFile: null, newestFile: null };
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Default instance
export const logRotationManager = new LogRotationManager();

// Standalone script functionality
if (require.main === module) {
  console.log('🔄 Starting log rotation cleanup...');
  logRotationManager.cleanupOldLogs().then(() => {
    const stats = logRotationManager.getLogStats();
    console.log('\n📊 Log Statistics:');
    console.log(`   Total files: ${stats.totalFiles}`);
    console.log(
      `   Total size: ${stats.totalFiles > 0 ? logRotationManager['formatBytes'](stats.totalSize) : '0 Bytes'}`,
    );
    if (stats.oldestFile) {
      console.log(`   Oldest file: ${stats.oldestFile.toISOString().split('T')[0]}`);
    }
    if (stats.newestFile) {
      console.log(`   Newest file: ${stats.newestFile.toISOString().split('T')[0]}`);
    }
    console.log('✅ Log rotation completed');
  });
}
