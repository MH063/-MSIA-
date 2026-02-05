import React, { useState, useEffect, useCallback, useRef } from 'react';
import './captcha.css';
import api, { unwrapData, getApiErrorMessage, type ApiResponse } from '../../utils/api';

interface CaptchaProps {
  onChange: (value: string) => void;
  onVerify: (isValid: boolean) => void;
  onIdChange?: (id: string) => void;
  externalCaptcha?: { id: string; svg: string } | undefined;
}

/**
 * 验证码组件
 * 显示图形验证码，支持点击刷新与30秒自动刷新
 */
const Captcha: React.FC<CaptchaProps> = ({ onChange, onVerify, onIdChange, externalCaptcha }) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [userInput, setUserInput] = useState('');
  const timerRef = useRef<number | null>(null);
  const onIdChangeRef = useRef<typeof onIdChange>(onIdChange);
  const onVerifyRef = useRef<typeof onVerify>(onVerify);

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
    console.log('[Captcha] 拉取服务端验证码');
    setUserInput('');
    try {
      const resp = (await api.get('/captcha/new')) as ApiResponse<{ id: string; svg: string }>;
      const payload = unwrapData<{ id: string; svg: string }>(resp);
      if (!resp?.success || !payload) throw new Error('验证码获取失败');
      const url = `data:image/svg+xml;utf8,${encodeURIComponent(payload.svg)}`;
      setImageUrl(url);
      onIdChangeRef.current?.(payload.id);
    } catch (err) {
      console.error('[Captcha] 获取验证码失败', getApiErrorMessage(err, '验证码获取失败'));
      onVerifyRef.current(false);
      const fallback = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#eee"/><text x="10" y="25" fill="#999" font-family="Arial" font-size="14">加载失败，点击重试</text></svg>`;
      setImageUrl(`data:image/svg+xml;utf8,${encodeURIComponent(fallback)}`);
    }
  }, []);

  // 应用服务端返回的外部验证码
  useEffect(() => {
    const c = externalCaptcha;
    if (!c || !c.id || !c.svg) return;
    console.log('[Captcha] 应用服务端返回的验证码');
    setUserInput('');
    const url = `data:image/svg+xml;utf8,${encodeURIComponent(c.svg)}`;
    setImageUrl(url);
    onIdChangeRef.current?.(c.id);
    onVerifyRef.current(false);
  }, [externalCaptcha]);

  /**
   * 启动自动刷新定时器（默认30秒）
   */
  const startAutoRefresh = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const id = window.setInterval(() => {
      console.log('[Captcha] 自动刷新验证码（30秒）');
      refreshCaptcha();
    }, 30000);
    timerRef.current = id;
  }, [refreshCaptcha]);

  // 定时器生命周期管理
  useEffect(() => {
    if (!externalCaptcha) {
      refreshCaptcha();
    }
    startAutoRefresh();
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [refreshCaptcha, startAutoRefresh, externalCaptcha]);

  // 用户点击刷新时，重置定时器到下一周期
  const handleManualRefresh = useCallback(() => {
    refreshCaptcha();
    startAutoRefresh();
  }, [refreshCaptcha, startAutoRefresh]);

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
      <div className="captcha-input-wrapper">
        <input
          type="text"
          value={userInput}
          onChange={handleInputChange}
          placeholder="请输入验证码（区分大小写）"
          maxLength={4}
          className="captcha-input"
        />
      </div>
      <div className="captcha-image-wrapper">
        {imageUrl && (
          <img
            src={imageUrl}
            alt="验证码"
            className="captcha-image"
            onClick={handleManualRefresh}
            title="点击刷新验证码"
          />
        )}
      </div>
    </div>
  );
};

export default Captcha;
