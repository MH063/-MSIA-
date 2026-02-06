import React, { Suspense, useEffect, useState } from 'react';
import type { PluggableList } from 'unified';
import logger from '../utils/logger';

const ReactMarkdownLazy = React.lazy(async () => {
  const mod = await import('react-markdown');
  return { default: mod.default };
});

export interface LazyMarkdownProps {
  content: string;
  className?: string;
}

/**
 * LazyMarkdown
 * 懒加载 Markdown 渲染组件，按需加载 react-markdown 和 remark/rehype 插件，减少初始包体积
 * - 仅在实际渲染时加载依赖
 * - 插件以异步方式注入，避免主包膨胀
 */
const LazyMarkdown: React.FC<LazyMarkdownProps> = ({ content, className }) => {
  const [remarkPlugins, setRemarkPlugins] = useState<PluggableList>([]);
  const [rehypePlugins] = useState<PluggableList>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const gfm = await import('remark-gfm');
        if (mounted) {
          setRemarkPlugins([gfm.default]);
          logger.info('[LazyMarkdown] 插件已按需加载');
        }
      } catch (e) {
        logger.warn('[LazyMarkdown] 插件加载失败，降级为纯文本渲染', e);
        if (mounted) {
          setRemarkPlugins([]);
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <Suspense fallback={<div style={{ padding: 12 }}>正在加载内容...</div>}>
      <div className={className}>
        <ReactMarkdownLazy
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
        >
          {content}
        </ReactMarkdownLazy>
      </div>
    </Suspense>
  );
};

export default LazyMarkdown;
