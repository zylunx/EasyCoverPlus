export type UploadProvider = 'imgbed' | 'r2' | 's3' | 'webdav';
export type ImgBedAuthMode = 'token' | 'authCode';

export interface ImgBedProviderConfig {
  baseUrl: string;
  authMode: ImgBedAuthMode;
  secret: string;
  channelName: string;
}

export interface R2ProviderConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Public URL prefix used after upload, e.g. https://cdn.example.com */
  publicBaseUrl: string;
}

export interface S3ProviderConfig {
  /** Empty = AWS default endpoint for the region. */
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
  forcePathStyle: boolean;
}

export interface WebDavProviderConfig {
  /** WebDAV collection URL, e.g. https://dav.example.com/files/user/ */
  serverUrl: string;
  username: string;
  password: string;
  /** Relative folder under serverUrl. Fixed default EasyCoverPlus. */
  basePath: string;
  /** Optional public URL prefix if WebDAV path is not publicly readable. */
  publicBaseUrl: string;
}

export interface UploadHostConfig {
  provider: UploadProvider;
  imgbed: ImgBedProviderConfig;
  r2: R2ProviderConfig;
  s3: S3ProviderConfig;
  webdav: WebDavProviderConfig;
}

export interface UploadHistoryItem {
  url: string;
  createdAt: number;
  format: string;
  filename: string;
}

export const UPLOAD_PROVIDERS: {
  id: UploadProvider;
  label: string;
  description: string;
}[] = [
  {
    id: 'imgbed',
    label: 'Cloudflare ImgBed',
    description: '独立适配：POST /upload（Token 或 authCode）',
  },
  {
    id: 'r2',
    label: 'R2',
    description: '独立适配：Cloudflare R2（S3 兼容签名直传）',
  },
  {
    id: 's3',
    label: 'S3',
    description: '独立适配：S3 / 兼容存储（签名直传）',
  },
  {
    id: 'webdav',
    label: 'WebDAV',
    description: '独立适配：WebDAV PUT 上传',
  },
];

const PROVIDER_IDS = new Set<UploadProvider>(UPLOAD_PROVIDERS.map((item) => item.id));

export function isUploadProvider(value: unknown): value is UploadProvider {
  return typeof value === 'string' && PROVIDER_IDS.has(value as UploadProvider);
}

export function getUploadProviderMeta(provider: UploadProvider) {
  return UPLOAD_PROVIDERS.find((item) => item.id === provider) ?? UPLOAD_PROVIDERS[0];
}

export const DEFAULT_UPLOAD_HOST_CONFIG: UploadHostConfig = {
  provider: 'imgbed',
  imgbed: {
    baseUrl: '',
    authMode: 'token',
    secret: '',
    channelName: '',
  },
  r2: {
    accountId: '',
    accessKeyId: '',
    secretAccessKey: '',
    bucket: '',
    publicBaseUrl: '',
  },
  s3: {
    endpoint: '',
    region: 'us-east-1',
    bucket: '',
    accessKeyId: '',
    secretAccessKey: '',
    publicBaseUrl: '',
    forcePathStyle: true,
  },
  webdav: {
    serverUrl: '',
    username: '',
    password: '',
    basePath: 'EasyCoverPlus',
    publicBaseUrl: '',
  },
};

// Back-compat aliases used by existing UI imports.
export type ImgBedConfig = UploadHostConfig;
export type ImgBedHistoryItem = UploadHistoryItem;
export const DEFAULT_IMGBED_CONFIG = DEFAULT_UPLOAD_HOST_CONFIG;
export const IMGBED_HISTORY_LIMIT = 20;
export const IMGBED_UPLOAD_RETRIES = 2;

const STORAGE_KEYS = {
  unlocked: 'easycover:imgbed:unlocked',
  config: 'easycover:imgbed:config',
  history: 'easycover:imgbed:history',
} as const;

const DEFAULT_PASSWORD_HASH =
  'fc60c2e02305786d0a127391148ea36419e15ea3b74cfe76893a93938a425b74';

export const getExpectedPasswordHash = (): string => {
  const fromEnv = process.env.NEXT_PUBLIC_UPLOAD_PASSWORD_HASH?.trim();
  return fromEnv || DEFAULT_PASSWORD_HASH;
};

export async function sha256Hex(value: string | ArrayBuffer | Uint8Array): Promise<string> {
  const data = typeof value === 'string'
    ? new TextEncoder().encode(value)
    : value instanceof Uint8Array
      ? value
      : new Uint8Array(value);
  const digest = await crypto.subtle.digest('SHA-256', data as BufferSource);
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
    // Ignore storage failures.
  }
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Migrate older single-provider localStorage shapes into independent providers. */
function normalizeConfig(raw: Record<string, unknown>): UploadHostConfig {
  const defaults = DEFAULT_UPLOAD_HOST_CONFIG;
  const nested = (key: keyof UploadHostConfig) => (
    raw[key] && typeof raw[key] === 'object'
      ? raw[key] as Record<string, unknown>
      : {}
  );

  // Very old shape: { baseUrl, authMode, secret } or { provider, baseUrl, ... }
  const legacyProvider = asString(raw.provider) || asString(raw.channel);
  const looksLegacyFlat = !raw.imgbed && !raw.r2 && !raw.s3 && !raw.webdav
    && (typeof raw.baseUrl === 'string' || typeof raw.secret === 'string');

  let provider: UploadProvider = defaults.provider;
  if (isUploadProvider(raw.provider)) {
    provider = raw.provider;
  } else if (legacyProvider === 'cloudflare' || legacyProvider === 'imgbed') {
    provider = 'imgbed';
  } else if (legacyProvider === 'r2' || legacyProvider === 'cfr2') {
    provider = 'r2';
  } else if (legacyProvider === 's3') {
    provider = 's3';
  } else if (legacyProvider === 'webdav') {
    provider = 'webdav';
  }

  const imgbedRaw = nested('imgbed');
  const r2Raw = nested('r2');
  const s3Raw = nested('s3');
  const webdavRaw = nested('webdav');

  const imgbed: ImgBedProviderConfig = {
    baseUrl: asString(imgbedRaw.baseUrl, looksLegacyFlat ? asString(raw.baseUrl) : ''),
    authMode: (asString(imgbedRaw.authMode, looksLegacyFlat ? asString(raw.authMode, 'token') : 'token') === 'authCode')
      ? 'authCode'
      : 'token',
    secret: asString(imgbedRaw.secret, looksLegacyFlat ? asString(raw.secret) : ''),
    channelName: asString(imgbedRaw.channelName, looksLegacyFlat ? asString(raw.channelName) : ''),
  };

  return {
    provider,
    imgbed,
    r2: {
      accountId: asString(r2Raw.accountId),
      accessKeyId: asString(r2Raw.accessKeyId),
      secretAccessKey: asString(r2Raw.secretAccessKey),
      bucket: asString(r2Raw.bucket),
      publicBaseUrl: asString(r2Raw.publicBaseUrl),
    },
    s3: {
      endpoint: asString(s3Raw.endpoint),
      region: asString(s3Raw.region, defaults.s3.region),
      bucket: asString(s3Raw.bucket),
      accessKeyId: asString(s3Raw.accessKeyId),
      secretAccessKey: asString(s3Raw.secretAccessKey),
      publicBaseUrl: asString(s3Raw.publicBaseUrl),
      forcePathStyle: asBoolean(s3Raw.forcePathStyle, defaults.s3.forcePathStyle),
    },
    webdav: {
      serverUrl: asString(webdavRaw.serverUrl),
      username: asString(webdavRaw.username),
      password: asString(webdavRaw.password),
      basePath: asString(webdavRaw.basePath, defaults.webdav.basePath) || defaults.webdav.basePath,
      publicBaseUrl: asString(webdavRaw.publicBaseUrl),
    },
  };
}

export function loadImgBedConfig(): UploadHostConfig {
  if (typeof window === 'undefined') {
    return structuredClone(DEFAULT_UPLOAD_HOST_CONFIG);
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.config);
    if (!raw) return structuredClone(DEFAULT_UPLOAD_HOST_CONFIG);
    return normalizeConfig(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return structuredClone(DEFAULT_UPLOAD_HOST_CONFIG);
  }
}

export function saveImgBedConfig(config: UploadHostConfig): void {
  if (typeof window === 'undefined') return;
  try {
    const normalized = normalizeConfig(config as unknown as Record<string, unknown>);
    window.localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(normalized));
  } catch {
    // Ignore storage failures.
  }
}

export function loadImgBedHistory(): UploadHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.history);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is UploadHistoryItem => (
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

export function pushImgBedHistory(item: Omit<UploadHistoryItem, 'createdAt'>): UploadHistoryItem[] {
  const nextItem: UploadHistoryItem = {
    ...item,
    createdAt: Date.now(),
  };
  const history = [nextItem, ...loadImgBedHistory().filter((entry) => entry.url !== nextItem.url)]
    .slice(0, IMGBED_HISTORY_LIMIT);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
    } catch {
      // Ignore.
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

export function isImgBedConfigReady(config: UploadHostConfig): boolean {
  switch (config.provider) {
    case 'imgbed':
      return Boolean(config.imgbed.baseUrl.trim() && config.imgbed.secret.trim());
    case 'r2':
      return Boolean(
        config.r2.accountId.trim()
        && config.r2.accessKeyId.trim()
        && config.r2.secretAccessKey.trim()
        && config.r2.bucket.trim()
        && config.r2.publicBaseUrl.trim(),
      );
    case 's3':
      return Boolean(
        config.s3.region.trim()
        && config.s3.bucket.trim()
        && config.s3.accessKeyId.trim()
        && config.s3.secretAccessKey.trim()
        && config.s3.publicBaseUrl.trim(),
      );
    case 'webdav':
      return Boolean(
        config.webdav.serverUrl.trim()
        && config.webdav.username.trim()
        && config.webdav.password.trim(),
      );
    default:
      return false;
  }
}

const joinUrl = (base: string, path: string): string => {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedPath}`;
};

const sanitizeObjectKey = (filename: string): string => {
  const cleaned = filename
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    ?.replace(/[^\w.\-()+@]/g, '_')
    || 'cover.png';
  return `EasyCoverPlus/${cleaned}`;
};

const normalizeBaseUrl = (baseUrl: string): string => {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) throw new Error('请填写站点地址');
  return new URL(trimmed).toString().replace(/\/+$/, '');
};

const extractImgBedUrl = (payload: unknown, baseUrl: string): string => {
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

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const keyBuffer = key instanceof Uint8Array
    ? key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength)
    : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

async function getSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${secretAccessKey}`), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

function toAmzDate(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

async function s3PutObject(options: {
  endpointHost: string;
  endpointProtocol: 'https:' | 'http:';
  region: string;
  bucket: string;
  objectKey: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  body: Blob;
  contentType: string;
}): Promise<void> {
  const {
    endpointHost,
    endpointProtocol,
    region,
    bucket,
    objectKey,
    accessKeyId,
    secretAccessKey,
    forcePathStyle,
    body,
    contentType,
  } = options;

  const method = 'PUT';
  const service = 's3';
  const { amzDate, dateStamp } = toAmzDate(new Date());
  const payloadHash = await sha256Hex(new Uint8Array(await body.arrayBuffer()));

  const canonicalUri = forcePathStyle
    ? `/${bucket}/${objectKey.split('/').map(encodeURIComponent).join('/')}`
    : `/${objectKey.split('/').map(encodeURIComponent).join('/')}`;

  const host = forcePathStyle
    ? endpointHost
    : `${bucket}.${endpointHost}`;

  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n';

  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    method,
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await getSigningKey(secretAccessKey, dateStamp, region, service);
  const signatureBytes = await hmacSha256(signingKey, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ');

  const requestUrl = `${endpointProtocol}//${host}${canonicalUri}`;
  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method,
      headers: {
        Authorization: authorization,
        'Content-Type': contentType,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
      },
      body,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`网络错误：${message}`);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`上传失败 HTTP ${response.status}${text ? `：${text.slice(0, 300)}` : ''}`);
  }
}

async function uploadViaImgBed(blob: Blob, filename: string, config: ImgBedProviderConfig): Promise<string> {
  if (!config.baseUrl.trim() || !config.secret.trim()) {
    throw new Error('请填写 ImgBed 站点地址与密钥');
  }

  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const uploadUrl = new URL('/upload', `${baseUrl}/`);
  uploadUrl.searchParams.set('returnFormat', 'full');
  uploadUrl.searchParams.set('uploadChannel', 'telegram');
  uploadUrl.searchParams.set('uploadFolder', 'EasyCoverPlus');
  if (config.channelName.trim()) {
    uploadUrl.searchParams.set('channelName', config.channelName.trim());
  }
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

  return extractImgBedUrl(payload, baseUrl);
}

async function uploadViaR2(blob: Blob, filename: string, config: R2ProviderConfig): Promise<string> {
  if (!isImgBedConfigReady({ ...DEFAULT_UPLOAD_HOST_CONFIG, provider: 'r2', r2: config })) {
    throw new Error('请完整填写 R2 参数（Account ID / Key / Bucket / 公开访问前缀）');
  }

  const accountId = config.accountId.trim();
  const bucket = config.bucket.trim();
  const objectKey = sanitizeObjectKey(filename);
  const contentType = blob.type || 'application/octet-stream';

  await s3PutObject({
    endpointHost: `${accountId}.r2.cloudflarestorage.com`,
    endpointProtocol: 'https:',
    region: 'auto',
    bucket,
    objectKey,
    accessKeyId: config.accessKeyId.trim(),
    secretAccessKey: config.secretAccessKey.trim(),
    forcePathStyle: true,
    body: blob,
    contentType,
  });

  return joinUrl(config.publicBaseUrl.trim(), objectKey);
}

async function uploadViaS3(blob: Blob, filename: string, config: S3ProviderConfig): Promise<string> {
  if (!isImgBedConfigReady({ ...DEFAULT_UPLOAD_HOST_CONFIG, provider: 's3', s3: config })) {
    throw new Error('请完整填写 S3 参数（Region / Bucket / Key / 公开访问前缀）');
  }

  const region = config.region.trim() || 'us-east-1';
  const bucket = config.bucket.trim();
  const objectKey = sanitizeObjectKey(filename);
  const contentType = blob.type || 'application/octet-stream';
  const customEndpoint = config.endpoint.trim();

  let endpointHost: string;
  let endpointProtocol: 'https:' | 'http:' = 'https:';
  let forcePathStyle = config.forcePathStyle;

  if (customEndpoint) {
    const endpointUrl = new URL(customEndpoint.includes('://') ? customEndpoint : `https://${customEndpoint}`);
    endpointHost = endpointUrl.host;
    endpointProtocol = endpointUrl.protocol === 'http:' ? 'http:' : 'https:';
    forcePathStyle = true;
  } else {
    endpointHost = `s3.${region}.amazonaws.com`;
    forcePathStyle = config.forcePathStyle;
  }

  await s3PutObject({
    endpointHost,
    endpointProtocol,
    region,
    bucket,
    objectKey,
    accessKeyId: config.accessKeyId.trim(),
    secretAccessKey: config.secretAccessKey.trim(),
    forcePathStyle,
    body: blob,
    contentType,
  });

  return joinUrl(config.publicBaseUrl.trim(), objectKey);
}

async function uploadViaWebDav(blob: Blob, filename: string, config: WebDavProviderConfig): Promise<string> {
  if (!config.serverUrl.trim() || !config.username.trim() || !config.password.trim()) {
    throw new Error('请填写 WebDAV 地址、用户名与密码');
  }

  const serverUrl = normalizeBaseUrl(config.serverUrl);
  const basePath = (config.basePath.trim() || 'EasyCoverPlus').replace(/^\/+|\/+$/g, '');
  const objectName = sanitizeObjectKey(filename).split('/').pop() || filename;
  const objectPath = `${basePath}/${objectName}`;
  const targetUrl = joinUrl(serverUrl, objectPath);
  const contentType = blob.type || 'application/octet-stream';
  const auth = btoa(`${config.username}:${config.password}`);

  // Ensure folder exists when server supports MKCOL (ignore failures).
  try {
    await fetch(joinUrl(serverUrl, basePath), {
      method: 'MKCOL',
      headers: { Authorization: `Basic ${auth}` },
    });
  } catch {
    // Ignore.
  }

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': contentType,
      },
      body: blob,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`网络错误：${message}`);
  }

  if (!response.ok && response.status !== 201 && response.status !== 204) {
    const text = await response.text().catch(() => '');
    throw new Error(`上传失败 HTTP ${response.status}${text ? `：${text.slice(0, 300)}` : ''}`);
  }

  if (config.publicBaseUrl.trim()) {
    return joinUrl(config.publicBaseUrl.trim(), objectPath);
  }
  return targetUrl;
}

export async function uploadToImgBed(
  blob: Blob,
  filename: string,
  config: UploadHostConfig,
): Promise<string> {
  if (!isImgBedConfigReady(config)) {
    throw new Error('请先完善当前渠道所需参数');
  }

  switch (config.provider) {
    case 'imgbed':
      return uploadViaImgBed(blob, filename, config.imgbed);
    case 'r2':
      return uploadViaR2(blob, filename, config.r2);
    case 's3':
      return uploadViaS3(blob, filename, config.s3);
    case 'webdav':
      return uploadViaWebDav(blob, filename, config.webdav);
    default:
      throw new Error(`暂不支持的渠道：${String((config as UploadHostConfig).provider)}`);
  }
}

export async function uploadToImgBedWithRetry(
  blob: Blob,
  filename: string,
  config: UploadHostConfig,
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
    // Fall through.
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
