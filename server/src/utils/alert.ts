/**
 * 告警系统
 * 提供邮件告警、系统异常监控和告警规则管理
 */

import nodemailer from 'nodemailer';
import { secureLogger } from './secureLogger';

/**
 * 告警级别
 */
type AlertLevel = 'info' | 'warning' | 'error' | 'critical';

/**
 * 告警配置
 */
interface AlertConfig {
  enabled: boolean;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  from: string;
  to: string[];
  level: AlertLevel;
  throttleInterval: number; // 告警节流间隔（毫秒）
}

/**
 * 告警消息
 */
interface AlertMessage {
  level: AlertLevel;
  title: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * 告警规则
 */
interface AlertRule {
  id: string;
  name: string;
  condition: (data: unknown) => boolean;
  level: AlertLevel;
  message: string;
  enabled: boolean;
}

/**
 * 告警统计
 */
interface AlertStats {
  totalSent: number;
  totalErrors: number;
  lastAlertTime: Date | null;
  alertsByLevel: Record<AlertLevel, number>;
}

/**
 * 告警管理器
 */
class AlertManager {
  private transporter: nodemailer.Transporter | null = null;
  private config: AlertConfig;
  private rules: AlertRule[] = [];
  private lastAlertTimes: Map<string, number> = new Map();
  private stats: AlertStats = {
    totalSent: 0,
    totalErrors: 0,
    lastAlertTime: null,
    alertsByLevel: {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    },
  };

  constructor() {
    this.config = this.loadConfig();
    this.initializeTransporter();
    this.setupDefaultRules();
  }

  /**
   * 加载配置
   */
  private loadConfig(): AlertConfig {
    return {
      enabled: process.env.ALERT_ENABLED === 'true',
      smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
      },
      from: process.env.ALERT_FROM || 'alert@msia.com',
      to: (process.env.ALERT_TO || '').split(',').filter(Boolean),
      level: (process.env.ALERT_LEVEL as AlertLevel) || 'error',
      throttleInterval: parseInt(process.env.ALERT_THROTTLE || '300000'), // 默认5分钟
    };
  }

  /**
   * 初始化邮件传输器
   */
  private initializeTransporter(): void {
    if (!this.config.enabled || !this.config.smtp.auth.user) {
      secureLogger.warn('[Alert] 告警系统未启用或配置不完整');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.smtp.host,
        port: this.config.smtp.port,
        secure: this.config.smtp.secure,
        auth: this.config.smtp.auth,
      });

      secureLogger.info('[Alert] 邮件传输器初始化成功');
    } catch (error) {
      secureLogger.error('[Alert] 邮件传输器初始化失败', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 设置默认告警规则
   */
  private setupDefaultRules(): void {
    // 数据库连接断开告警
    this.addRule({
      id: 'db-disconnect',
      name: '数据库连接断开',
      condition: (data: unknown) => {
        const d = data as { type: string; healthy: boolean };
        return d.type === 'database' && !d.healthy;
      },
      level: 'critical',
      message: '数据库连接已断开，请立即检查！',
      enabled: true,
    });

    // 高错误率告警
    this.addRule({
      id: 'high-error-rate',
      name: '高错误率',
      condition: (data: unknown) => {
        const d = data as { type: string; errorRate: number };
        return d.type === 'error-rate' && d.errorRate > 0.1;
      },
      level: 'error',
      message: '系统错误率超过10%，请关注！',
      enabled: true,
    });

    // 内存使用过高告警
    this.addRule({
      id: 'high-memory',
      name: '内存使用过高',
      condition: (data: unknown) => {
        const d = data as { type: string; usage: number };
        return d.type === 'memory' && d.usage > 0.9;
      },
      level: 'warning',
      message: '系统内存使用超过90%，请关注！',
      enabled: true,
    });

    // 慢查询告警
    this.addRule({
      id: 'slow-query',
      name: '慢查询',
      condition: (data: unknown) => {
        const d = data as { type: string; duration: number };
        return d.type === 'slow-query' && d.duration > 5000;
      },
      level: 'warning',
      message: '检测到慢查询，查询时间超过5秒',
      enabled: true,
    });
  }

  /**
   * 发送告警
   */
  async sendAlert(alert: Omit<AlertMessage, 'timestamp'>): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    // 检查告警级别
    if (!this.shouldSendByLevel(alert.level)) {
      return false;
    }

    // 检查节流
    if (this.isThrottled(alert.title)) {
      secureLogger.debug('[Alert] 告警被节流', { title: alert.title });
      return false;
    }

    const fullAlert: AlertMessage = {
      ...alert,
      timestamp: new Date(),
    };

    try {
      // 发送邮件
      if (this.transporter) {
        await this.sendEmail(fullAlert);
      }

      // 记录日志
      this.logAlert(fullAlert);

      // 更新统计
      this.updateStats(fullAlert.level);

      // 更新最后告警时间
      this.lastAlertTimes.set(alert.title, Date.now());

      return true;
    } catch (error) {
      this.stats.totalErrors++;
      secureLogger.error('[Alert] 发送告警失败', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 发送邮件
   */
  private async sendEmail(alert: AlertMessage): Promise<void> {
    if (!this.transporter || this.config.to.length === 0) {
      return;
    }

    const subject = `[${alert.level.toUpperCase()}] ${alert.title}`;
    const html = this.generateEmailHtml(alert);

    await this.transporter.sendMail({
      from: this.config.from,
      to: this.config.to,
      subject,
      html,
    });

    this.stats.totalSent++;
    secureLogger.info('[Alert] 邮件告警已发送', {
      level: alert.level,
      title: alert.title,
      to: this.config.to,
    });
  }

  /**
   * 生成邮件 HTML
   */
  private generateEmailHtml(alert: AlertMessage): string {
    const levelColors: Record<AlertLevel, string> = {
      info: '#3498db',
      warning: '#f39c12',
      error: '#e74c3c',
      critical: '#c0392b',
    };

    const detailsHtml = alert.details
      ? Object.entries(alert.details)
          .map(([key, value]) => `<tr><td><strong>${key}</strong></td><td>${JSON.stringify(value)}</td></tr>`)
          .join('')
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${levelColors[alert.level]}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          td { padding: 8px; border-bottom: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🚨 系统告警</h2>
            <p>级别: ${alert.level.toUpperCase()}</p>
          </div>
          <div class="content">
            <h3>${alert.title}</h3>
            <p>${alert.message}</p>
            <p><strong>时间:</strong> ${alert.timestamp.toLocaleString('zh-CN')}</p>
            ${detailsHtml ? `<h4>详细信息</h4><table>${detailsHtml}</table>` : ''}
          </div>
          <div class="footer">
            <p>此邮件由 MSIA 系统自动发送</p>
            <p>医学生智能问诊辅助系统</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 记录告警日志
   */
  private logAlert(alert: AlertMessage): void {
    const logData = {
      level: alert.level,
      message: alert.message,
      details: alert.details,
    };

    switch (alert.level) {
      case 'info':
        secureLogger.info(`[Alert] ${alert.title}`, logData);
        break;
      case 'warning':
        secureLogger.warn(`[Alert] ${alert.title}`, logData);
        break;
      case 'error':
      case 'critical':
        secureLogger.error(`[Alert] ${alert.title}`, new Error(alert.message), logData);
        break;
    }
  }

  /**
   * 更新统计
   */
  private updateStats(level: AlertLevel): void {
    this.stats.alertsByLevel[level]++;
    this.stats.lastAlertTime = new Date();
  }

  /**
   * 检查是否应该根据级别发送
   */
  private shouldSendByLevel(level: AlertLevel): boolean {
    const levels: AlertLevel[] = ['info', 'warning', 'error', 'critical'];
    const configLevelIndex = levels.indexOf(this.config.level);
    const alertLevelIndex = levels.indexOf(level);
    return alertLevelIndex >= configLevelIndex;
  }

  /**
   * 检查是否被节流
   */
  private isThrottled(title: string): boolean {
    const lastTime = this.lastAlertTimes.get(title);
    if (!lastTime) {return false;}
    return Date.now() - lastTime < this.config.throttleInterval;
  }

  /**
   * 添加告警规则
   */
  addRule(rule: AlertRule): void {
    this.rules.push(rule);
    secureLogger.debug('[Alert] 告警规则已添加', { id: rule.id, name: rule.name });
  }

  /**
   * 移除告警规则
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index > -1) {
      this.rules.splice(index, 1);
      secureLogger.debug('[Alert] 告警规则已移除', { id: ruleId });
      return true;
    }
    return false;
  }

  /**
   * 检查规则并触发告警
   */
  async checkRules(data: unknown): Promise<void> {
    for (const rule of this.rules) {
      if (!rule.enabled) {continue;}

      try {
        if (rule.condition(data)) {
          await this.sendAlert({
            level: rule.level,
            title: rule.name,
            message: rule.message,
            details: data as Record<string, unknown>,
          });
        }
      } catch (error) {
        secureLogger.error('[Alert] 规则检查失败', error instanceof Error ? error : new Error(String(error)), {
          ruleId: rule.id,
        });
      }
    }
  }

  /**
   * 获取统计
   */
  getStats(): AlertStats {
    return { ...this.stats };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      totalSent: 0,
      totalErrors: 0,
      lastAlertTime: null,
      alertsByLevel: {
        info: 0,
        warning: 0,
        error: 0,
        critical: 0,
      },
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...config };
    this.initializeTransporter();
    secureLogger.info('[Alert] 配置已更新');
  }

  /**
   * 测试邮件发送
   */
  async testEmail(): Promise<boolean> {
    return this.sendAlert({
      level: 'info',
      title: '测试告警',
      message: '这是一条测试告警邮件，用于验证告警系统配置是否正确。',
    });
  }
}

// 导出单例
export const alertManager = new AlertManager();

// 导出便捷函数
export const alert = {
  /**
   * 发送信息级别告警
   */
  info: (title: string, message: string, details?: Record<string, unknown>) =>
    alertManager.sendAlert({ level: 'info', title, message, details }),

  /**
   * 发送警告级别告警
   */
  warning: (title: string, message: string, details?: Record<string, unknown>) =>
    alertManager.sendAlert({ level: 'warning', title, message, details }),

  /**
   * 发送错误级别告警
   */
  error: (title: string, message: string, details?: Record<string, unknown>) =>
    alertManager.sendAlert({ level: 'error', title, message, details }),

  /**
   * 发送严重级别告警
   */
  critical: (title: string, message: string, details?: Record<string, unknown>) =>
    alertManager.sendAlert({ level: 'critical', title, message, details }),
};

// 导出类型
export type { AlertLevel, AlertConfig, AlertMessage, AlertRule, AlertStats };
