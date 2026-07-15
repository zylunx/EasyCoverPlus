'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  clearImgBedHistory,
  copyTextToClipboard,
  createProbePngBlob,
  isImgBedConfigReady,
  isImgBedUnlocked,
  loadImgBedConfig,
  loadImgBedHistory,
  pushImgBedHistory,
  saveImgBedConfig,
  setImgBedUnlocked,
  uploadToImgBedWithRetry,
  verifyImgBedPassword,
  type ImgBedAuthMode,
  type ImgBedConfig,
  type ImgBedHistoryItem,
} from '@/lib/imgbed';
import { Check, Copy, Link2, Loader2, Lock, Settings2, Trash2, Unlock } from 'lucide-react';

export interface ImgBedControlsHandle {
  maybeUpload: (blob: Blob, filename: string, format: string) => Promise<void>;
}

interface ImgBedControlsProps {
  disabled?: boolean;
}

export const ImgBedControls = React.forwardRef<ImgBedControlsHandle, ImgBedControlsProps>(
  function ImgBedControls({ disabled = false }, ref) {
    const [unlocked, setUnlocked] = React.useState(false);
    const [uploadEnabled, setUploadEnabled] = React.useState(false);
    const [config, setConfig] = React.useState<ImgBedConfig>({
      baseUrl: '',
      authMode: 'token',
      secret: '',
    });
    const [history, setHistory] = React.useState<ImgBedHistoryItem[]>([]);
    const [toast, setToast] = React.useState<string | null>(null);

    const [unlockOpen, setUnlockOpen] = React.useState(false);
    const [password, setPassword] = React.useState('');
    const [unlockError, setUnlockError] = React.useState<string | null>(null);
    const [unlocking, setUnlocking] = React.useState(false);

    const [settingsOpen, setSettingsOpen] = React.useState(false);
    const [draftConfig, setDraftConfig] = React.useState<ImgBedConfig>(config);
    const [testing, setTesting] = React.useState(false);
    const [testMessage, setTestMessage] = React.useState<string | null>(null);

    const [failOpen, setFailOpen] = React.useState(false);
    const [failError, setFailError] = React.useState('');
    const failRetryRef = React.useRef<null | (() => Promise<void>)>(null);
    const [retrying, setRetrying] = React.useState(false);

    const [copiedUrl, setCopiedUrl] = React.useState<string | null>(null);

    React.useEffect(() => {
      setUnlocked(isImgBedUnlocked());
      setConfig(loadImgBedConfig());
      setHistory(loadImgBedHistory());
    }, []);

    React.useEffect(() => {
      if (!toast) return;
      const timer = window.setTimeout(() => setToast(null), 3200);
      return () => window.clearTimeout(timer);
    }, [toast]);

    const showToast = (message: string) => setToast(message);

    const handleUnlock = async () => {
      setUnlocking(true);
      setUnlockError(null);
      try {
        const ok = await verifyImgBedPassword(password);
        if (!ok) {
          setUnlockError('密码不正确');
          return;
        }
        setImgBedUnlocked(true);
        setUnlocked(true);
        setUnlockOpen(false);
        setPassword('');
        showToast('图床权限已解锁');
      } finally {
        setUnlocking(false);
      }
    };

    const handleLock = () => {
      setImgBedUnlocked(false);
      setUnlocked(false);
      setUploadEnabled(false);
      setSettingsOpen(false);
      showToast('图床权限已锁定');
    };

    const openSettings = () => {
      if (!unlocked) {
        setUnlockOpen(true);
        return;
      }
      setDraftConfig(loadImgBedConfig());
      setTestMessage(null);
      setSettingsOpen(true);
    };

    const saveSettings = () => {
      const next: ImgBedConfig = {
        baseUrl: draftConfig.baseUrl.trim(),
        authMode: draftConfig.authMode,
        secret: draftConfig.secret,
      };
      saveImgBedConfig(next);
      setConfig(next);
      setSettingsOpen(false);
      showToast('图床配置已保存');
    };

    const handleTestConfig = async () => {
      setTesting(true);
      setTestMessage(null);
      try {
        const probe = createProbePngBlob();
        const url = await uploadToImgBedWithRetry(probe, 'easycover-probe.png', draftConfig, 1);
        setTestMessage(`测试成功：${url}`);
      } catch (error) {
        setTestMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setTesting(false);
      }
    };

    const onToggleUpload = (checked: boolean) => {
      if (!unlocked) {
        setUnlockOpen(true);
        return;
      }
      if (checked && !isImgBedConfigReady(config)) {
        showToast('请先配置图床');
        openSettings();
        return;
      }
      setUploadEnabled(checked);
    };

    const recordSuccess = React.useCallback(async (url: string, filename: string, format: string) => {
      const copied = await copyTextToClipboard(url);
      setHistory(pushImgBedHistory({ url, filename, format }));
      showToast(copied ? '已上传并复制链接' : `已上传：${url}`);
    }, []);

    const runUpload = React.useCallback(async (blob: Blob, filename: string, format: string) => {
      const latestConfig = loadImgBedConfig();
      setConfig(latestConfig);
      if (!isImgBedConfigReady(latestConfig)) {
        throw new Error('请先在图床设置中填写 baseUrl 与密钥');
      }
      const url = await uploadToImgBedWithRetry(blob, filename, latestConfig);
      await recordSuccess(url, filename, format);
    }, [recordSuccess]);

    React.useImperativeHandle(ref, () => ({
      maybeUpload: async (blob, filename, format) => {
        if (!uploadEnabled || !unlocked) return;
        try {
          await runUpload(blob, filename, format);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setFailError(message);
          failRetryRef.current = async () => {
            setRetrying(true);
            try {
              await runUpload(blob, filename, format);
              setFailOpen(false);
            } catch (retryError) {
              setFailError(retryError instanceof Error ? retryError.message : String(retryError));
            } finally {
              setRetrying(false);
            }
          };
          setFailOpen(true);
        }
      },
    }), [runUpload, uploadEnabled, unlocked]);

    const copyHistoryUrl = async (url: string) => {
      const ok = await copyTextToClipboard(url);
      if (ok) {
        setCopiedUrl(url);
        window.setTimeout(() => setCopiedUrl((current) => (current === url ? null : current)), 1500);
      }
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Switch
                id="imgbed-upload-toggle"
                checked={uploadEnabled}
                disabled={disabled}
                onCheckedChange={onToggleUpload}
              />
              <Label
                htmlFor="imgbed-upload-toggle"
                className={`text-xs leading-snug ${!unlocked ? 'text-muted-foreground' : ''}`}
              >
                同时上传到图床
              </Label>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              本地优先；开启后会将封面发送到你配置的图床。
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              disabled={disabled}
              onClick={() => {
                if (unlocked) {
                  handleLock();
                } else {
                  setUnlockError(null);
                  setPassword('');
                  setUnlockOpen(true);
                }
              }}
              title={unlocked ? '锁定图床权限' : '验证图床权限'}
            >
              {unlocked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
              <span className="text-xs">{unlocked ? '已解锁' : '验证权限'}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              disabled={disabled || !unlocked}
              onClick={openSettings}
              title={unlocked ? '图床设置' : '解锁后可配置图床'}
            >
              <Settings2 className="size-3.5" />
            </Button>
          </div>
        </div>

        {toast && (
          <p className="rounded-md border bg-background px-2 py-1.5 text-center text-[11px] text-foreground">
            {toast}
          </p>
        )}

        {history.length > 0 && (
          <div className="rounded-md border bg-background/60 p-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <Link2 className="size-3" />
                最近上传
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[11px]"
                onClick={() => {
                  clearImgBedHistory();
                  setHistory([]);
                }}
              >
                <Trash2 className="size-3" />
                清空
              </Button>
            </div>
            <ul className="max-h-28 space-y-1 overflow-y-auto">
              {history.map((item) => (
                <li key={`${item.createdAt}-${item.url}`} className="flex items-center gap-1">
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-[11px] text-blue-600 hover:underline dark:text-blue-400"
                    title={item.url}
                    onClick={() => copyHistoryUrl(item.url)}
                  >
                    {item.url}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 shrink-0 p-0"
                    onClick={() => copyHistoryUrl(item.url)}
                    title="复制链接"
                  >
                    {copiedUrl === item.url ? (
                      <Check className="size-3 text-green-600" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>验证图床权限</DialogTitle>
              <DialogDescription>
                输入密码以解锁自定义图床配置与上传。哈希比对仅在本地完成。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="imgbed-password">密码</Label>
              <Input
                id="imgbed-password"
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleUnlock();
                  }
                }}
              />
              {unlockError && (
                <p className="text-xs text-red-500">{unlockError}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUnlockOpen(false)}>
                取消
              </Button>
              <Button type="button" disabled={unlocking || !password} onClick={() => void handleUnlock()}>
                {unlocking ? <Loader2 className="size-4 animate-spin" /> : null}
                解锁
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>图床设置</DialogTitle>
              <DialogDescription>
                适配 CloudFlare ImgBed：`POST /upload`，支持 API Token 或 authCode。
                密钥仅保存在本机 localStorage。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="imgbed-base-url">站点地址 baseUrl</Label>
                <Input
                  id="imgbed-base-url"
                  placeholder="https://your-imgbed.example"
                  value={draftConfig.baseUrl}
                  onChange={(event) => setDraftConfig((prev) => ({
                    ...prev,
                    baseUrl: event.target.value,
                  }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>认证方式</Label>
                <Select
                  value={draftConfig.authMode}
                  onValueChange={(value: ImgBedAuthMode) => setDraftConfig((prev) => ({
                    ...prev,
                    authMode: value,
                  }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="token">API Token（Bearer）</SelectItem>
                    <SelectItem value="authCode">上传认证码 authCode</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="imgbed-secret">
                  {draftConfig.authMode === 'token' ? 'API Token' : 'authCode'}
                </Label>
                <Input
                  id="imgbed-secret"
                  type="password"
                  autoComplete="off"
                  value={draftConfig.secret}
                  onChange={(event) => setDraftConfig((prev) => ({
                    ...prev,
                    secret: event.target.value,
                  }))}
                />
              </div>
              {testMessage && (
                <p className="break-all text-xs text-muted-foreground">{testMessage}</p>
              )}
            </div>
            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="secondary"
                disabled={testing || !draftConfig.baseUrl.trim() || !draftConfig.secret.trim()}
                onClick={() => void handleTestConfig()}
              >
                {testing ? <Loader2 className="size-4 animate-spin" /> : null}
                测试上传配置
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
                  取消
                </Button>
                <Button type="button" onClick={saveSettings}>
                  保存
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={failOpen} onOpenChange={setFailOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>图床上传失败</DialogTitle>
              <DialogDescription>
                本地文件已保存。可重试上传、仅保留本地，或复制错误详情。
              </DialogDescription>
            </DialogHeader>
            <p className="max-h-40 overflow-y-auto break-all rounded-md border bg-muted/40 p-2 text-xs">
              {failError}
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await copyTextToClipboard(failError);
                  showToast('已复制错误详情');
                }}
              >
                复制错误详情
              </Button>
              <Button type="button" variant="secondary" onClick={() => setFailOpen(false)}>
                仅保留本地
              </Button>
              <Button
                type="button"
                disabled={retrying || !failRetryRef.current}
                onClick={() => {
                  void failRetryRef.current?.();
                }}
              >
                {retrying ? <Loader2 className="size-4 animate-spin" /> : null}
                重试
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  },
);
