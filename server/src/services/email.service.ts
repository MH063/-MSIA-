import nodemailer from 'nodemailer';
import { secureLogger } from '../utils/secureLogger';

type EmailTransporter = nodemailer.Transporter;

let transporter: EmailTransporter | null = null;

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

/**
 * 获取邮件配置
 */
function getEmailConfig(): EmailConfig | null {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.ALERT_FROM || 'noreply@msia.com';
  
  if (!host || !user || !pass) {
    secureLogger.warn('[email-service] SMTP配置不完整，邮件发送功能不可用');
    return null;
  }
  
  return {
    host,
    port,
    secure: port === 465,
    user,
    pass,
    from,
  };
}

/**
 * 初始化邮件传输器
 */
export function initEmailTransporter(): EmailTransporter | null {
  const config = getEmailConfig();
  if (!config) {
    return null;
  }
  
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
  
  secureLogger.info('[email-service] 邮件传输器初始化成功', { host: config.host, port: config.port });
  
  return transporter;
}

/**
 * 获取邮件传输器
 */
export function getEmailTransporter(): EmailTransporter | null {
  if (!transporter) {
    return initEmailTransporter();
  }
  return transporter;
}

/**
 * 发送验证码邮件
 */
export async function sendVerificationEmail(
  email: string,
  code: string,
  type: 'register' | 'reset_password' | 'change_email'
): Promise<{ success: boolean; error?: string }> {
  const config = getEmailConfig();
  const transport = getEmailTransporter();
  
  if (!transport || !config) {
    secureLogger.warn('[email-service] 邮件服务不可用，验证码将仅输出到控制台（开发模式）');
    if (process.env.NODE_ENV === 'development') {
      secureLogger.info('[email-service] 开发模式验证码', { 
        email, 
        type, 
        codePreview: `${code.slice(0, 2)}****` 
      });
      return { success: true };
    }
    return { success: false, error: '邮件服务不可用' };
  }
  
  const subjects: Record<string, string> = {
    register: '【MSIA】注册验证码',
    reset_password: '【MSIA】密码重置验证码',
    change_email: '【MSIA】邮箱变更验证码',
  };
  
  const typeNames: Record<string, string> = {
    register: '注册账号',
    reset_password: '重置密码',
    change_email: '变更邮箱',
  };
  
  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subjects[type]}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1890ff; margin: 0; font-size: 24px;">医学生智能问诊辅助系统</h1>
            <p style="color: #666; margin: 10px 0 0;">Medical Student Intelligent Assistant</p>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 30px;">
            <p style="color: #333; font-size: 16px; line-height: 1.6;">您好！</p>
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              您正在进行<strong>${typeNames[type]}</strong>操作，验证码如下：
            </p>
            
            <div style="background-color: #f0f7ff; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #1890ff; letter-spacing: 8px;">${code}</span>
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              验证码有效期为 <strong>10分钟</strong>，请尽快完成验证。如非本人操作，请忽略此邮件。
            </p>
          </div>
          
          <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px; text-align: center;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              此邮件由系统自动发送，请勿直接回复。
            </p>
            <p style="color: #999; font-size: 12px; margin: 10px 0 0;">
              © ${new Date().getFullYear()} 医学生智能问诊辅助系统 MSIA
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  try {
    await transport.sendMail({
      from: config.from,
      to: email,
      subject: subjects[type],
      html,
    });
    
    secureLogger.info('[email-service] 邮件发送成功', { email, type });
    
    if (process.env.NODE_ENV === 'development') {
      secureLogger.info('[email-service] 开发模式验证码已发送', { 
        email, 
        type, 
        codePreview: `${code.slice(0, 2)}****` 
      });
    }
    
    return { success: true };
  } catch (err) {
    secureLogger.error('[email-service] 邮件发送失败', err instanceof Error ? err : undefined);
    
    if (process.env.NODE_ENV === 'development') {
      secureLogger.warn('[email-service] 开发模式邮件发送失败，但仍返回成功', { 
        email, 
        type, 
        codePreview: `${code.slice(0, 2)}****` 
      });
      return { success: true };
    }
    
    return { success: false, error: '邮件发送失败，请稍后重试' };
  }
}

/**
 * 发送密码修改通知邮件
 */
export async function sendPasswordChangedNotification(email: string): Promise<{ success: boolean; error?: string }> {
  const config = getEmailConfig();
  const transport = getEmailTransporter();
  
  if (!transport || !config) {
    return { success: true };
  }
  
  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>【MSIA】密码修改通知</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1890ff; margin: 0; font-size: 24px;">医学生智能问诊辅助系统</h1>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 30px;">
            <p style="color: #333; font-size: 16px; line-height: 1.6;">您好！</p>
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              您的账户密码已于 <strong>${new Date().toLocaleString('zh-CN')}</strong> 修改成功。
            </p>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              如非本人操作，请立即联系管理员或通过"忘记密码"功能重置密码。
            </p>
          </div>
          
          <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px; text-align: center;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              此邮件由系统自动发送，请勿直接回复。
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  try {
    await transport.sendMail({
      from: config.from,
      to: email,
      subject: '【MSIA】密码修改通知',
      html,
    });
    
    secureLogger.info('[email-service] 密码修改通知邮件发送成功', { email });
    
    return { success: true };
  } catch (err) {
    secureLogger.error('[email-service] 密码修改通知邮件发送失败', err instanceof Error ? err : undefined);
    return { success: false, error: '邮件发送失败' };
  }
}

/**
 * 发送邮箱变更通知邮件
 */
export async function sendEmailChangedNotification(oldEmail: string, newEmail: string): Promise<{ success: boolean }> {
  const config = getEmailConfig();
  const transport = getEmailTransporter();
  
  if (!transport || !config) {
    return { success: true };
  }
  
  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>【MSIA】邮箱变更通知</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1890ff; margin: 0; font-size: 24px;">医学生智能问诊辅助系统</h1>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 30px;">
            <p style="color: #333; font-size: 16px; line-height: 1.6;">您好！</p>
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              您的账户绑定邮箱已从 <strong>${oldEmail}</strong> 变更为 <strong>${newEmail}</strong>。
            </p>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              如非本人操作，请立即联系管理员。
            </p>
          </div>
          
          <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px; text-align: center;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              此邮件由系统自动发送，请勿直接回复。
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  try {
    await transport.sendMail({
      from: config.from,
      to: oldEmail,
      subject: '【MSIA】邮箱变更通知',
      html,
    });
    
    secureLogger.info('[email-service] 邮箱变更通知邮件发送成功', { oldEmail, newEmail });
  } catch (err) {
    secureLogger.error('[email-service] 邮箱变更通知邮件发送失败', err instanceof Error ? err : undefined);
  }
  
  return { success: true };
}
