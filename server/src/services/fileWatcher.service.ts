import { FSWatcher, watch } from 'chokidar';
import path from 'path';
import fs from 'fs';
import { fileProcessor } from './fileProcessor.service';

export class FileWatcherService {
  private watcher: FSWatcher | null = null;
  private rootDir: string;

  /**
   * 初始化文件监控服务
   * @param rootDir 监控的知识库根目录
   */
  constructor(rootDir: string) {
    this.rootDir = rootDir;
    // Ensure directory exists
    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir, { recursive: true });
    }
  }

  /**
   * 启动文件监控器，监听知识库目录的新增、修改、删除事件
   */
  public start() {
    console.log(`[FileWatcher] Starting watch on: ${this.rootDir}`);
    
    this.watcher = watch(this.rootDir, {
      persistent: true,
      ignoreInitial: false, // Process files already there on startup
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      depth: 5,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });

    this.watcher
      .on('add', (filePath: string) => this.handleFile(filePath))
      .on('change', (filePath: string) => this.handleFile(filePath))
      .on('unlink', (filePath: string) => fileProcessor.handleFileDelete(filePath, this.rootDir))
      .on('error', (error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[FileWatcher] Error: ${msg}`);
      });
  }

  /**
   * 处理知识库文件变更，仅处理支持的扩展名
   * @param filePath 变更文件的绝对或相对路径
   */
  private handleFile(filePath: string) {
    // Only process supported extensions
    const ext = path.extname(filePath).toLowerCase();
    if (['.md', '.txt', '.json'].includes(ext)) {
      fileProcessor.enqueue(filePath, this.rootDir);
    }
  }

  /**
   * 停止文件监控器
   */
  public stop() {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}

// Singleton instance can be exported if needed, but usually we instantiate in index.ts
