export type ImgBedAuthMode = 'token' | 'authCode';

export interface ImgBedConfig {
  baseUrl: string;
  authMode: ImgBedAuthMode;
  secret: string;
}

export interface ImgBedHistoryItem {
  url: string;
  createdAt: number;
  format: string;
  filename: string;
}

const STORAGE_KEYS = {
  unlocked: 'easycover:imgbed:unlocked',
  config: 'easycover:imgbed:config',
  history: 'easycover:imgbed:history',
} as const;

export const IMGBED_HISTORY_LIMIT = 20;
export const IMGBED_UPLOAD_RETRIES = 2;

// Default password: easycover-upload
// Override with NEXT_PUBLIC_UPLOAD_PASSWORD_HASH (sha-256 hex).
const DEFAULT_PASSWORD_HASH =
  'fc60c2e02305786d0a127391148ea36419e15ea3b74cfe76893a93938a425b74';

export const getExpectedPasswordHash = (): string => {
  const fromEnv = process.env.NEXT_PUBLIC_UPLOAD_PASSWORD_HASH?.trim();
  return fromEnv || DEFAULT_PASSWORD_HASH;
};

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyImgBedPassword(password: string): Promise<boolean> {
  const hash = await sha256Hex(password);
  return hash === getExpectedPasswordHash();
}

export function isImgBedUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEYS.unlocked) === '1';
  } catch {
    return false;
  }
}

export function setImgBedUnlocked(unlocked: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (unlocked) {
      window.localStorage.setItem(STORAGE_KEYS.unlocked, '1');
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.unlocked);
    }
  } catch {
    // Ignore quota / private mode failures; unlock still works in-memory for the session caller.
  }
}

export function loadImgBedConfig(): ImgBedConfig {
  if (typeof window === 'undefined') {
    return { baseUrl: '', authMode: 'token', secret: '' };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.config);
    if (!raw) return { baseUrl: '', authMode: 'token', secret: '' };
    const parsed = JSON.parse(raw) as Partial<ImgBedConfig>;
    return {
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : '',
      authMode: parsed.authMode === 'authCode' ? 'authCode' : 'token',
      secret: typeof parsed.secret === 'string' ? parsed.secret : '',
    };
  } catch {
    return { baseUrl: '', authMode: 'token', secret: '' };
  }
}

export function saveImgBedConfig(config: ImgBedConfig): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.config, JSON.stringify({
      baseUrl: config.baseUrl.trim(),
      authMode: config.authMode,
      secret: config.secret,
    }));
  } catch {
    // Ignore storage failures.
  }
}

export function loadImgBedHistory(): ImgBedHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.history);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is ImgBedHistoryItem => (
        item
        && typeof item.url === 'string'
        && typeof item.createdAt === 'number'
        && typeof item.format === 'string'
        && typeof item.filename === 'string'
      ))
      .slice(0, IMGBED_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function pushImgBedHistory(item: Omit<ImgBedHistoryItem, 'createdAt'>): ImgBedHistoryItem[] {
  const nextItem: ImgBedHistoryItem = {
    ...item,
    createdAt: Date.now(),
  };
  const history = [nextItem, ...loadImgBedHistory().filter((entry) => entry.url !== nextItem.url)]
    .slice(0, IMGBED_HISTORY_LIMIT);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
    } catch {
      // Ignore storage failures; still return the in-memory list for the UI.
    }
  }
  return history;
}

export function clearImgBedHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEYS.history);
  } catch {
    // Ignore.
  }
}

export function isImgBedConfigReady(config: ImgBedConfig): boolean {
  return Boolean(config.baseUrl.trim() && config.secret.trim());
}

const normalizeBaseUrl = (baseUrl: string): string => {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) throw new Error('请填写图床站点地址 baseUrl');
  // Ensure URL constructor accepts the value.
  return new URL(trimmed).toString().replace(/\/+$/, '');
};

const extractUploadUrl = (payload: unknown, baseUrl: string): string => {
  const item = Array.isArray(payload)
    ? payload[0]
    : (payload && typeof payload === 'object' && Array.isArray((payload as { result?: unknown }).result)
      ? (payload as { result: unknown[] }).result[0]
      : payload);

  if (!item || typeof item !== 'object') {
    throw new Error('图床响应格式无效');
  }

  const record = item as Record<string, unknown>;
  const publicUrl = typeof record.publicUrl === 'string' ? record.publicUrl.trim() : '';
  const url = typeof record.url === 'string' ? record.url.trim() : '';
  const src = typeof record.src === 'string' ? record.src.trim() : '';

  if (publicUrl) return publicUrl;
  if (url) {
    if (/^https?:\/\//i.test(url)) return url;
    return new URL(url, `${baseUrl}/`).toString();
  }
  if (src) {
    if (/^https?:\/\//i.test(src)) return src;
    return new URL(src, `${baseUrl}/`).toString();
  }

  throw new Error('图床响应中未找到图片链接');
};

export async function uploadToImgBed(
  blob: Blob,
  filename: string,
  config: ImgBedConfig,
): Promise<string> {
  if (!isImgBedConfigReady(config)) {
    throw new Error('请先在图床设置中填写 baseUrl 与密钥');
  }

  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const uploadUrl = new URL('/upload', `${baseUrl}/`);
  uploadUrl.searchParams.set('returnFormat', 'full');
  uploadUrl.searchParams.set('uploadChannel', 'telegram');
  uploadUrl.searchParams.set('uploadFolder', 'EasyCoverPlus');
  if (config.authMode === 'authCode') {
    uploadUrl.searchParams.set('authCode', config.secret.trim());
  }

  const formData = new FormData();
  formData.append('file', blob, filename);

  const headers: HeadersInit = {};
  if (config.authMode === 'token') {
    headers.Authorization = `Bearer ${config.secret.trim()}`;
  }

  let response: Response;
  try {
    response = await fetch(uploadUrl.toString(), {
      method: 'POST',
      headers,
      body: formData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`网络错误：${message}`);
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const detail = payload && typeof payload === 'object'
      ? String((payload as { error?: unknown; message?: unknown }).error
        || (payload as { message?: unknown }).message
        || text.slice(0, 300))
      : text.slice(0, 300);
    throw new Error(`上传失败 HTTP ${response.status}${detail ? `：${detail}` : ''}`);
  }

  if (payload && typeof payload === 'object' && !Array.isArray(payload)
    && (payload as { success?: unknown }).success === false) {
    const detail = String(
      (payload as { error?: unknown; message?: unknown }).error
      || (payload as { message?: unknown }).message
      || 'success=false',
    );
    throw new Error(`上传失败：${detail}`);
  }

  return extractUploadUrl(payload, baseUrl);
}

export async function uploadToImgBedWithRetry(
  blob: Blob,
  filename: string,
  config: ImgBedConfig,
  retries = IMGBED_UPLOAD_RETRIES,
): Promise<string> {
  let lastError: Error | null = null;
  const attempts = Math.max(1, retries + 1);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await uploadToImgBed(blob, filename, config);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt >= attempts) break;
      await new Promise((resolve) => {
        window.setTimeout(resolve, attempt * 500);
      });
    }
  }
  throw lastError ?? new Error('上传失败');
}

/** Tiny 1×1 PNG used only for "test upload config". */
export function createProbePngBlob(): Blob {
  const bytes = Uint8Array.from(atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5WNloAAAAASUVORK5CYII=',
  ), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: 'image/png' });
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to legacy path.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}
