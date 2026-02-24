import React, { useState, useEffect, useCallback, useRef } from 'react';
import { theme } from 'antd';
import './captcha.css';
import api, { unwrapData, getApiErrorMessage, type ApiResponse } from '../../utils/api';
import logger from '../../utils/logger';

interface CaptchaProps {
  onChange: (value: string) => void;
  onVerify: (isValid: boolean) => void;
  onIdChange?: (id: string) => void;
  externalCaptcha?: { id: string; svg: string } | undefined;
}

/**
 * 验证码组件
 * 显示图形验证码，支持点击刷新和30秒自动刷新
 */
const Captcha: React.FC<CaptchaProps> = ({ onChange, onVerify, onIdChange, externalCaptcha }) => {
  const { token } = theme.useToken();
  // const isDark = token.algorithmId === theme.darkAlgorithm;
  const [imageUrl, setImageUrl] = useState<string>('');
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<number | null>(null);
  const onIdChangeRef = useRef<typeof onIdChange>(onIdChange);
  const onVerifyRef = useRef<typeof onVerify>(onVerify);
  const refreshRef = useRef<(() => Promise<void> | void) | undefined>(undefined);

  useEffect(() => {
    onIdChangeRef.current = onIdChange;
  }, [onIdChange]);

  useEffect(() => {
    onVerifyRef.current = onVerify;
  }, [onVerify]);

  /**
   * 刷新验证码
   */
  const refreshCaptcha = useCallback(async () => {
    if (isLoading) return;
    logger.info('[Captcha] 开始拉取服务端验证码');
    setIsLoading(true);
    setUserInput('');
    try {
      const resp = (await api.get('/captcha/new', { timeout: 8000 })) as ApiResponse<{ id: string; svg: string }>;
      logger.info('[Captcha] 验证码响应:', resp);
      const payload = unwrapData<{ id: string; svg: string }>(resp);
      logger.info('[Captcha] 解析后的payload:', payload);
      if (!resp?.success || !payload) {
        throw new Error('验证码获取失败：响应数据无效');
      }
      if (!payload.svg) {
        throw new Error('验证码获取失败：缺少SVG数据');
      }
      const url = `data:image/svg+xml;utf8,${encodeURIComponent(payload.svg)}`;
      logger.info('[Captcha] 生成的图片URL长度:', url.length);
      setImageUrl(url);
      onIdChangeRef.current?.(payload.id);
    } catch (err) {
      logger.error('[Captcha] 获取验证码失败:', err);
      logger.error('[Captcha] 错误详情:', getApiErrorMessage(err, '验证码获取失败'));
      onVerifyRef.current(false);
      const fallback = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="${token.colorFillAlter}"/><text x="10" y="25" fill="${token.colorTextSecondary}" font-family="Arial" font-size="14">加载失败，点击重试</text></svg>`;
      setImageUrl(`data:image/svg+xml;utf8,${encodeURIComponent(fallback)}`);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  useEffect(() => {
    refreshRef.current = refreshCaptcha;
  }, [refreshCaptcha]);

  // 应用服务端返回的外部验证码
  useEffect(() => {
    const c = externalCaptcha;
    if (!c || !c.id || !c.svg) return;
    logger.info('[Captcha] 应用服务端返回的验证码');
    setUserInput('');
    const url = `data:image/svg+xml;utf8,${encodeURIComponent(c.svg)}`;
    setImageUrl(url);
    onIdChangeRef.current?.(c.id);
    onVerifyRef.current(false);
  }, [externalCaptcha]);

  // 组件挂载时加载验证码
  useEffect(() => {
    logger.info('[Captcha] 组件挂载，准备加载验证码');
    if (!externalCaptcha) {
      refreshRef.current?.();
    }
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [externalCaptcha]);

  // 启动自动刷新定时器（30秒）
  useEffect(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    timerRef.current = window.setInterval(() => {
      logger.info('[Captcha] 自动刷新验证码（30秒）');
      refreshCaptcha();
    }, 30000);
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [refreshCaptcha]);

  // 用户点击刷新时，重置定时器到下一周期
  const handleManualRefresh = useCallback(() => {
    logger.info('[Captcha] 用户手动刷新验证码');
    refreshCaptcha();
  }, [refreshCaptcha]);

  /**
   * 处理用户输入
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUserInput(value);
    onChange(value);
    onVerify(value.length === 4);
  };

  return (
    <div className="captcha-container">
      <style>{`
        .captcha-input {
          background: ${token.colorBgContainer} !important;
          border-color: ${token.colorBorder} !important;
          color: ${token.colorText} !important;
        }
        .captcha-input:hover {
          border-color: ${token.colorPrimary} !important;
          background: ${token.colorBgContainer} !important;
        }
        .captcha-input:focus {
          border-color: ${token.colorPrimary} !important;
          background: ${token.colorBgContainer} !important;
          box-shadow: 0 0 0 2px ${token.colorPrimaryBg} !important;
        }
        .captcha-input::placeholder {
          color: ${token.colorTextPlaceholder} !important;
        }
        .captcha-image {
          border-color: ${token.colorBorder} !important;
        }
        .captcha-image:hover {
          border-color: ${token.colorPrimary} !important;
          box-shadow: ${token.boxShadow} !important;
        }
        .captcha-refresh-btn {
          color: ${token.colorTextSecondary} !important;
        }
        .captcha-refresh-btn:hover {
          background: ${token.colorFillTertiary} !important;
          color: ${token.colorPrimary} !important;
        }
      `}</style>
      <div className="captcha-input-wrapper">
        <input
          type="text"
          value={userInput}
          onChange={handleInputChange}
          placeholder="请输入验证码（区分大小写）"
          maxLength={4}
          className="captcha-input"
          disabled={isLoading}
        />
      </div>
      <div className="captcha-image-wrapper">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="验证码"
            className="captcha-image"
            onClick={handleManualRefresh}
            title="点击刷新验证码"
            style={{ opacity: isLoading ? 0.5 : 1 }}
          />
        ) : (
          <div 
            className="captcha-image" 
            onClick={handleManualRefresh}
            title="点击加载验证码"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              background: token.colorFillAlter,
              color: token.colorTextPlaceholder,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            {isLoading ? '加载中...' : '点击加载'}
          </div>
        )}
      </div>
    </div>
  );
};

export default Captcha;
