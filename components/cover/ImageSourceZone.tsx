'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ClipboardPaste, ImagePlus, Loader2 } from 'lucide-react';

const readFileAsDataUrl = (file: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'));
  reader.onload = () => resolve(reader.result as string);
  reader.readAsDataURL(file);
});

const preloadImage = (src: string): Promise<void> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve();
  image.onerror = () => reject(new Error('The selected image could not be decoded'));
  image.src = src;
});

const isImageFile = (file: Blob | null | undefined): file is Blob =>
  Boolean(file && file.type.startsWith('image/'));

const pickFirstImageFile = (files: FileList | File[] | null | undefined): File | null => {
  if (!files) return null;
  const list = Array.from(files);
  return list.find((file) => file.type.startsWith('image/')) ?? null;
};

const getPasteShortcutLabel = () => {
  if (typeof navigator === 'undefined') return 'Ctrl+V';
  const platform = navigator.platform || '';
  const ua = navigator.userAgent || '';
  const isApple = /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS X/i.test(ua);
  return isApple ? '⌘V' : 'Ctrl+V';
};

export interface ImageSourceZoneProps {
  /** Called with a preloaded data URL after a successful import. */
  onImage: (dataUrl: string) => void;
  /** Optional status line, e.g. whether an image is already set. */
  hasImage?: boolean;
  className?: string;
  disabled?: boolean;
}

export function ImageSourceZone({
  onImage,
  hasImage = false,
  className,
  disabled = false,
}: ImageSourceZoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const zoneRef = React.useRef<HTMLDivElement>(null);
  const busyRef = React.useRef(false);
  const [dragOver, setDragOver] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [hint, setHint] = React.useState<string | null>(null);
  const [shortcutLabel] = React.useState(getPasteShortcutLabel);

  React.useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(() => setHint(null), 3200);
    return () => window.clearTimeout(timer);
  }, [hint]);

  const showSoftHint = React.useCallback((message: string) => {
    setHint(message);
  }, []);

  const setBusyState = React.useCallback((next: boolean) => {
    busyRef.current = next;
    setBusy(next);
  }, []);

  const importImageBlob = React.useCallback(async (blob: Blob) => {
    if (!isImageFile(blob)) {
      showSoftHint('请选择图片文件');
      return;
    }

    // html-to-image needs a stable data URL during export; blob: URLs are not reliable.
    const url = await readFileAsDataUrl(blob);
    await preloadImage(url);
    onImage(url);
  }, [onImage, showSoftHint]);

  const runImport = React.useCallback(async (task: () => Promise<void>) => {
    if (disabled || busyRef.current) return;
    setBusyState(true);
    setHint(null);
    try {
      await task();
    } catch (error) {
      console.error('Failed to load image source', error);
      alert('图片读取失败，请尝试其他图片文件');
    } finally {
      setBusyState(false);
    }
  }, [disabled, setBusyState]);

  const importFromFileList = React.useCallback(async (files: FileList | File[] | null | undefined) => {
    const file = pickFirstImageFile(files);
    if (!file) {
      showSoftHint('未找到可用的图片文件');
      return;
    }
    await runImport(() => importImageBlob(file));
  }, [importImageBlob, runImport, showSoftHint]);

  const handleInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    try {
      await importFromFileList(files);
    } finally {
      event.target.value = '';
    }
  };

  const openFilePicker = () => {
    if (disabled || busyRef.current) return;
    inputRef.current?.click();
  };

  const handlePasteEvent = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled || busyRef.current) return;

    const items = event.clipboardData?.items;
    if (!items || items.length === 0) {
      showSoftHint('剪贴板中没有图片');
      return;
    }

    for (const item of Array.from(items)) {
      if (!item.type.startsWith('image/')) continue;
      event.preventDefault();
      const file = item.getAsFile();
      if (!file) {
        showSoftHint('剪贴板中没有图片');
        return;
      }
      await runImport(() => importImageBlob(file));
      return;
    }

    showSoftHint('剪贴板中没有图片');
  };

  const handlePasteButton = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled || busyRef.current) return;

    // Focus the zone so a follow-up keyboard paste works after a permission failure.
    zoneRef.current?.focus();

    if (!navigator.clipboard?.read) {
      showSoftHint(`当前浏览器不支持读取剪贴板，请聚焦此区域后按 ${shortcutLabel}`);
      return;
    }

    await runImport(async () => {
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const type = item.types.find((entry) => entry.startsWith('image/'));
          if (!type) continue;
          const blob = await item.getType(type);
          await importImageBlob(blob);
          return;
        }
        showSoftHint('剪贴板中没有图片');
      } catch (error) {
        // Permission errors are expected soft failures; decode errors still use alert via runImport.
        if (error instanceof Error && /read|denied|permission|not allowed/i.test(error.message)) {
          showSoftHint(`无法读取剪贴板，请改为点击此区域后按 ${shortcutLabel}`);
          return;
        }
        // clipboard.read() often throws DOMException with name NotAllowedError
        if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
          showSoftHint(`无法读取剪贴板，请改为点击此区域后按 ${shortcutLabel}`);
          return;
        }
        throw error;
      }
    });
  };

  const onDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled || busyRef.current) return;
    setDragOver(true);
  };

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled || busyRef.current) return;
    event.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  };

  const onDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    // Only clear when leaving the zone itself, not when entering a child.
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setDragOver(false);
  };

  const onDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    if (disabled || busyRef.current) return;
    await importFromFileList(event.dataTransfer.files);
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <div
        ref={zoneRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || busy}
        aria-label="上传图片：点击选择、拖入文件，或粘贴"
        onClick={openFilePicker}
        onKeyDown={(event) => {
          if (disabled || busyRef.current) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openFilePicker();
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPaste={(event) => {
          void handlePasteEvent(event);
        }}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={(event) => {
          void onDrop(event);
        }}
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-4 text-center transition-colors outline-none',
          'bg-muted/20 hover:bg-muted/40',
          dragOver && 'border-primary bg-primary/5',
          focused && 'border-primary ring-2 ring-primary/20',
          (disabled || busy) && 'pointer-events-none opacity-60',
          !disabled && !busy && 'cursor-pointer',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          disabled={disabled || busy}
          onChange={(event) => {
            void handleInputChange(event);
          }}
        />

        <div className="flex items-center justify-center text-muted-foreground">
          {busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <ImagePlus className="size-5" />
          )}
        </div>

        <div className="space-y-0.5">
          <p className="text-xs font-medium">
            {busy ? '正在读取图片…' : '点击选择或拖入图片'}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {hasImage ? '已有图片，导入将替换（保留变换）' : '支持常见图片格式'}
            {' · '}
            聚焦后 {shortcutLabel} 粘贴
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={disabled || busy}
          onClick={(event) => {
            void handlePasteButton(event);
          }}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ClipboardPaste className="size-3.5" />
          )}
          粘贴图片
        </Button>
      </div>

      {hint && (
        <p className="text-center text-[11px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
