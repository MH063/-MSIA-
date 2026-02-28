/**
 * Cookie 解析工具函数
 * 从 Cookie 头字符串解析为键值对对象
 */

/**
 * 解析 Cookie 头字符串
 * @param raw Cookie 头字符串
 * @returns 解析后的键值对对象
 */
export function parseCookieHeader(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const s = String(raw || '').trim();
  if (!s) {
    return out;
  }
  const parts = s.split(';');
  for (const part of parts) {
    const p = part.trim();
    if (!p) {
      continue;
    }
    const idx = p.indexOf('=');
    if (idx <= 0) {
      continue;
    }
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    if (!k) {
      continue;
    }
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

/**
 * 从请求中读取指定名称的 Cookie 值
 * @param req Express 请求对象
 * @param name Cookie 名称
 * @returns Cookie 值或 null
 */
export function readCookieFromRequest(req: { header: (name: string) => string | undefined }, name: string): string | null {
  const raw = String(req.header('cookie') || '').trim();
  if (!raw) {
    return null;
  }
  const jar = parseCookieHeader(raw);
  const v = String(jar[name] || '').trim();
  return v || null;
}
