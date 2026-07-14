'use client';

import React from 'react';
import { useCoverStore, RATIOS, AspectRatio } from '@/store/useCoverStore';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/color-picker';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconPicker } from '@/components/cover/IconPicker';
import { Separator } from '@/components/ui/separator';
import { Download, RotateCcw, Maximize, Github, ExternalLink, Settings2, Link as LinkIcon, Link2, Upload, HardDrive, Search, AlignLeft, AlignCenter, AlignRight, Lock, Unlock, ArrowLeftRight, MoveRight, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toCanvas } from 'html-to-image';

type ExportFormat = 'png' | 'webp' | 'avif';

const EXPORT_MIME_TYPES: Record<ExportFormat, string> = {
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};

const EXPORT_QUALITY = 0.95;

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  format: ExportFormat,
): Promise<Blob> => new Promise((resolve, reject) => {
  const mimeType = EXPORT_MIME_TYPES[format];
  canvas.toBlob((blob) => {
    if (!blob || blob.type !== mimeType) {
      reject(new Error(`${format.toUpperCase()} encoding is not supported`));
      return;
    }
    resolve(blob);
  }, mimeType, EXPORT_QUALITY);
});

const sanitizeExportFilename = (leftText: string, rightText: string) => {
  const normalize = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();
  const combined = `${normalize(leftText)}${normalize(rightText)}`
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();
  return Array.from(combined || 'east-cover-plus').slice(0, 80).join('');
};

// Helper component for Reset Button
const ResetButton = ({ onClick, tooltip = "重置" }: { onClick: () => void, tooltip?: string }) => (
    <Button 
        variant="ghost" 
        size="icon" 
        className="h-6 w-6 ml-2" 
        onClick={onClick}
        title={tooltip}
    >
        <RotateCcw className="h-3 w-3" />
    </Button>
);

const FONTS = [
    { name: 'Inter (默认)', value: 'Inter, sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { name: 'MiSans', value: 'MiSans, sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { name: 'HarmonyOS Sans', value: '"HarmonyOS Sans", sans-serif', weights: [100, 400, 700] },
    { name: '得意黑 (Smiley Sans)', value: 'SmileySans, sans-serif', weights: [400] },
    { name: 'OPPO Sans', value: 'OPPOSans, sans-serif', weights: [400] },
    { name: 'Geist Sans', value: 'var(--font-geist-sans), sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { name: 'Geist Mono', value: 'var(--font-geist-mono), monospace', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { name: 'Arial', value: 'Arial, sans-serif', weights: [400, 700] },
    { name: 'Times New Roman', value: '"Times New Roman", serif', weights: [400, 700] },
    { name: 'Courier New', value: '"Courier New", monospace', weights: [400, 700] },
    { name: '微软雅黑', value: '"Microsoft YaHei", sans-serif', weights: [300, 400, 700] },
    { name: '黑体', value: 'SimHei, sans-serif', weights: [400] },
    { name: '楷体', value: 'KaiTi, serif', weights: [400] },
];

const SliderWithInput = ({
    label, 
    value, 
    onChange, 
    min, 
    max, 
    step = 1 
}: { 
    label: string, 
    value: number, 
    onChange: (val: number) => void, 
    min: number, 
    max: number, 
    step?: number 
}) => {
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between items-center">
                <Label className="text-[10px] text-muted-foreground">{label}</Label>
                <Input
                    type="number"
                    value={value}
                    onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) onChange(val);
                    }}
                    className="h-5 w-12 text-[10px] px-1 text-right"
                />
            </div>
            <Slider 
                value={[value]} 
                min={min} 
                max={max} 
                step={step} 
                onValueChange={(v) => onChange(v[0])} 
            />
        </div>
    );
};

export default function Controls() {
  const store = useCoverStore();
  const [supportedExportFormats, setSupportedExportFormats] = React.useState<Record<ExportFormat, boolean>>({
    png: true,
    webp: false,
    avif: false,
  });
  const [exportingFormat, setExportingFormat] = React.useState<ExportFormat | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const detectFormats = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext('2d');
      context?.fillRect(0, 0, 1, 1);

      const supports = async (format: ExportFormat) => {
        try {
          await canvasToBlob(canvas, format);
          return true;
        } catch {
          return false;
        }
      };
      const [webp, avif] = await Promise.all([supports('webp'), supports('avif')]);
      if (!cancelled) {
        setSupportedExportFormats({ png: true, webp, avif });
      }
    };

    void detectFormats();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pixel-sized sliders should scale with the canvas, not be hard-pinned.
  // Base every "size/distance/blur radius" max on the largest edge of the active canvas.
  const canvasMax = React.useMemo(() => {
    const active = RATIOS.filter((r) => store.selectedRatios.includes(r.label));
    if (active.length === 0) return 2100;
    return Math.max(...active.map((r) => Math.max(r.width, r.height)));
  }, [store.selectedRatios]);
  const pct = (p: number) => Math.max(1, Math.round(canvasMax * p));


  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      store.updateBackground({ type: 'image', imageUrl: url });
    }
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      store.updateIcon({ customIconUrl: url });
    }
  };

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        try {
            const fontName = `CustomFont_${Date.now()}`;
            const url = URL.createObjectURL(file);
            const font = new FontFace(fontName, `url(${url})`);
            await font.load();
            document.fonts.add(font);
            store.updateText({ font: fontName });
        } catch (err) {
            console.error('Failed to load font', err);
            alert('字体加载失败，请尝试其他字体文件');
        }
    }
  };

  const [localFonts, setLocalFonts] = React.useState<{ family: string; fullName: string; postscriptName: string }[]>([]);
  const [localFontsOpen, setLocalFontsOpen] = React.useState(false);
  const [localFontQuery, setLocalFontQuery] = React.useState('');
  const [localFontsLoading, setLocalFontsLoading] = React.useState(false);

  const [isLocalFontApiSupported, setIsLocalFontApiSupported] = React.useState(false);
  React.useEffect(() => {
    setIsLocalFontApiSupported('queryLocalFonts' in window);
  }, []);

  const handleLoadLocalFonts = async () => {
    if (!isLocalFontApiSupported) {
        alert('当前浏览器不支持本地字体读取 API（需要 Chromium 系浏览器，且页面运行于 HTTPS 或 localhost）。');
        return;
    }
    try {
        setLocalFontsLoading(true);
        // @ts-expect-error - Local Font Access API is not in default TS lib
        const fonts: Array<{ family: string; fullName: string; postscriptName: string }> = await window.queryLocalFonts();
        // Deduplicate by family
        const seen = new Set<string>();
        const unique = fonts.filter((f) => {
            if (seen.has(f.family)) return false;
            seen.add(f.family);
            return true;
        });
        unique.sort((a, b) => a.family.localeCompare(b.family));
        setLocalFonts(unique);
        setLocalFontsOpen(true);
    } catch (err) {
        console.error('Failed to query local fonts', err);
        alert('读取本地字体失败：' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
        setLocalFontsLoading(false);
    }
  };

  const handlePickLocalFont = (family: string) => {
    const value = `"${family}", sans-serif`;
    store.updateText({ font: value });
    setLocalFontsOpen(false);
    setLocalFontQuery('');
  };

  const handleExport = async (format: ExportFormat) => {
    const node = document.getElementById('canvas-export-target');
    if (!node || !supportedExportFormats[format]) return;

    const options = {
      quality: 0.95,
      pixelRatio: 1,
      cacheBust: true,
      // Cross-origin font stylesheets block cssRules access in html-to-image.
      skipFonts: true,
      filter: (n: HTMLElement) => !(n.classList && n.classList.contains('export-exclude')),
    };

    setExportingFormat(format);
    try {
      if (document.fonts && (document.fonts as any).ready) {
        await (document.fonts as any).ready;
      }

      const images = Array.from(node.querySelectorAll('img'));
      await Promise.all(
        images.map((img) => {
          if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
          return new Promise<void>((resolve) => {
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          });
        })
      );

      // The first render can miss lazily-loaded Iconify SVGs, fonts, or filters.
      await toCanvas(node as HTMLElement, options);
      const canvas = await toCanvas(node as HTMLElement, options);
      const blob = await canvasToBlob(canvas, format);
      const objectUrl = URL.createObjectURL(blob);
      const filename = sanitizeExportFilename(
        store.text.leftContent,
        store.text.rightContent,
      );

      const link = document.createElement('a');
      link.download = `${filename}.${format}`;
      link.href = objectUrl;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (err) {
      console.error('Export failed', err);
      alert(`导出 ${format.toUpperCase()} 失败，请重试`);
    } finally {
      setExportingFormat(null);
    }
  };

  const handleFit = (mode: 'contain' | 'cover') => {
      // Always reset position and rotation
      const updates: any = { positionX: 50, positionY: 50, rotation: 0 };
      
      // We will simply reset scale to 1 and let user manually adjust if they want 'contain'.
      // But for 'cover', we try to calculate a scale that fills the canvas.
      
      if (mode === 'contain') {
          updates.scale = 1;
      } else {
          // Calculate scale to cover
          // 1. Get current canvas dimensions
          const activeRatios = RATIOS.filter((r) => store.selectedRatios.includes(r.label));
          if (activeRatios.length > 0 && store.background.imageUrl) {
               const maxWidth = Math.max(...activeRatios.map((r) => r.width));
               const maxHeight = Math.max(...activeRatios.map((r) => r.height));
               const canvasRatio = maxWidth / maxHeight;

               // 2. Get image dimensions
               const img = new Image();
               img.src = store.background.imageUrl;
               img.onload = () => {
                   const imgRatio = img.naturalWidth / img.naturalHeight;
                   
                   let newScale = 1;
                   if (imgRatio > canvasRatio) {
                       // Image is wider than canvas: Scale based on Height
                       // Contain logic makes width match canvas (if img wider? No.)
                       // Let's revisit: 
                       // In 'contain' (object-fit), img is scaled so it fits inside.
                       // If imgRatio > canvasRatio (Image is flatter):
                       //   It hits the sides first. Width = CanvasWidth. Height = Width / imgRatio.
                       //   To cover, we need Height = CanvasHeight.
                       //   Scale = CanvasHeight / CurrentHeight = CanvasHeight / (CanvasWidth / imgRatio)
                       //         = (CanvasHeight / CanvasWidth) * imgRatio = imgRatio / canvasRatio.
                       newScale = imgRatio / canvasRatio;
                   } else {
                       // Image is taller than canvas:
                       //   It hits top/bottom first. Height = CanvasHeight. Width = Height * imgRatio.
                       //   To cover, we need Width = CanvasWidth.
                       //   Scale = CanvasWidth / CurrentWidth = CanvasWidth / (CanvasHeight * imgRatio)
                       //         = (CanvasWidth / CanvasHeight) / imgRatio = canvasRatio / imgRatio.
                       newScale = canvasRatio / imgRatio;
                   }
                   
                   // Apply with a slight buffer to avoid sub-pixel gaps
                   store.updateBackground({ ...updates, scale: newScale * 1.01 });
               };
               return; // Async update
          } else {
              // Fallback
              updates.scale = 1;
          }
      }
      store.updateBackground(updates);
  };

  const [activeTab, setActiveTab] = React.useState('picker');
  const [lockedAxes, setLockedAxes] = React.useState<Record<string, boolean>>({
    offsetX: true,
    offsetY: true,
  });
  // false = mirror (正反, default: left +X → right -X), true = same direction (正正, left +X → right +X)
  const [lockMode, setLockMode] = React.useState<Record<string, boolean>>({
    offsetX: false,
    offsetY: false,
  });
  const toggleLock = (key: string) => setLockedAxes((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleLockMode = (key: string) => setLockMode((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleLeftOffsetChange = (axis: 'x' | 'y', val: number) => {
      const key = axis === 'x' ? 'offsetX' : 'offsetY';
      const updates: any = { [axis === 'x' ? 'leftOffsetX' : 'leftOffsetY']: val };
      if (lockedAxes[key]) {
          updates[axis === 'x' ? 'rightOffsetX' : 'rightOffsetY'] = lockMode[key] ? val : -val;
      }
      store.updateText(updates);
  };

  const handleRightOffsetChange = (axis: 'x' | 'y', val: number) => {
      const key = axis === 'x' ? 'offsetX' : 'offsetY';
      const updates: any = { [axis === 'x' ? 'rightOffsetX' : 'rightOffsetY']: val };
      if (lockedAxes[key]) {
          updates[axis === 'x' ? 'leftOffsetX' : 'leftOffsetY'] = lockMode[key] ? val : -val;
      }
      store.updateText(updates);
  };

  const [panelWidth, setPanelWidth] = React.useState(320);
  const isResizing = React.useRef(false);

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(Math.max(startWidth + (ev.clientX - startX), 260), 800);
      setPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [panelWidth]);

  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => {
      el.style.width = mq.matches ? `${panelWidth}px` : '';
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [panelWidth]);

  return (
    <div
      ref={panelRef}
      className="w-full flex-1 md:flex-none md:h-full border-t md:border-t-0 bg-background flex flex-col shadow-lg z-10 min-h-0 relative"
    >
      <div
        className="hidden md:block absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/20 active:bg-primary/30 z-20"
        onMouseDown={handleMouseDown}
      />
      <div className="flex-1 min-h-0 w-full">
        <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
          
          {/* Layout Section */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">布局设置</h3>
            
            <div className="space-y-2">
              <Label>图片比例</Label>
              <div className="grid grid-cols-2 gap-2">
                {RATIOS.map((r) => (
                  <div key={r.label} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`ratio-${r.label}`} 
                      checked={store.selectedRatios.includes(r.label)}
                      onCheckedChange={() => store.toggleRatio(r.label)}
                    />
                    <label htmlFor={`ratio-${r.label}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {r.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="show-ruler">显示标尺 / 网格</Label>
              <Switch 
                id="show-ruler" 
                checked={store.showRuler} 
                onCheckedChange={store.setShowRuler} 
              />
            </div>
          </section>

          <Separator />

          {/* Text Section */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">文字设置</h3>
            <div className="space-y-2">
              <Label>左侧内容</Label>
              <Input
                value={store.text.leftContent}
                onChange={(e) => store.updateText({ leftContent: e.target.value })}
              />
              <Label>右侧内容</Label>
              <Input
                value={store.text.rightContent}
                onChange={(e) => store.updateText({ rightContent: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
               <Label>字体</Label>
               <div className="flex gap-2">
                   <Select value={store.text.font.startsWith('CustomFont') ? 'custom' : store.text.font} onValueChange={(v) => {
                       if (v !== 'custom') store.updateText({ font: v });
                   }}>
                       <SelectTrigger className="flex-1">
                           <SelectValue placeholder="选择字体" />
                       </SelectTrigger>
                       <SelectContent>
                           {FONTS.map((font) => (
                               <SelectItem key={font.name} value={font.value} style={{ fontFamily: font.value }}>
                                   {font.name}
                               </SelectItem>
                           ))}
                           {store.text.font.startsWith('CustomFont') && (
                               <SelectItem value="custom">自定义字体</SelectItem>
                           )}
                       </SelectContent>
                   </Select>
                   
                   <div className="relative">
                       <Input
                           type="file"
                           accept=".ttf,.otf,.woff,.woff2"
                           className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                           onChange={handleFontUpload}
                           title="上传字体"
                       />
                       <Button variant="outline" size="icon" className="w-10 px-0">
                           <Upload className="h-4 w-4" />
                       </Button>
                   </div>

                   <Popover open={localFontsOpen} onOpenChange={setLocalFontsOpen}>
                       <PopoverTrigger asChild>
                           <Button
                               variant="outline"
                               size="icon"
                               className="w-10 px-0"
                               title={isLocalFontApiSupported ? '从本机字体中选择' : '当前浏览器不支持本地字体 API'}
                               disabled={!isLocalFontApiSupported}
                               onClick={(e) => {
                                   if (localFonts.length === 0) {
                                       e.preventDefault();
                                       handleLoadLocalFonts();
                                   }
                               }}
                           >
                               {localFontsLoading ? (
                                   <RotateCcw className="h-4 w-4 animate-spin" />
                               ) : (
                                   <HardDrive className="h-4 w-4" />
                               )}
                           </Button>
                       </PopoverTrigger>
                       <PopoverContent className="w-[280px] p-0" align="end">
                           <div className="p-2 border-b">
                               <div className="relative">
                                   <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                   <Input
                                       placeholder="搜索本机字体..."
                                       className="pl-7 h-8 text-xs"
                                       value={localFontQuery}
                                       onChange={(e) => setLocalFontQuery(e.target.value)}
                                   />
                               </div>
                               <div className="text-[10px] text-muted-foreground mt-1 px-1">
                                   共 {localFonts.length} 个字体族
                               </div>
                           </div>
                           <ScrollArea className="h-[280px]">
                               <div className="p-1">
                                   {localFonts
                                       .filter((f) => !localFontQuery || f.family.toLowerCase().includes(localFontQuery.toLowerCase()))
                                       .slice(0, 200)
                                       .map((f) => (
                                           <button
                                               key={f.postscriptName || f.family}
                                               className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center justify-between gap-2"
                                               onClick={() => handlePickLocalFont(f.family)}
                                           >
                                               <span className="truncate" style={{ fontFamily: `"${f.family}"` }}>
                                                   {f.family}
                                               </span>
                                           </button>
                                       ))}
                                   {localFonts.length === 0 && (
                                       <div className="text-center text-xs text-muted-foreground py-6">
                                           点击按钮加载本机字体
                                       </div>
                                   )}
                               </div>
                           </ScrollArea>
                       </PopoverContent>
                   </Popover>
               </div>
            </div>

            <div className="space-y-2">
               <div className="flex justify-between items-center">
                   <Label>字重 ({store.text.fontWeight})</Label>
                   <ResetButton onClick={() => store.updateText({ fontWeight: 800 })} />
               </div>
               <Slider
                   value={[store.text.fontWeight]}
                   min={100}
                   max={900}
                   step={1}
                   onValueChange={(v) => store.updateText({ fontWeight: v[0] })}
               />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                 <Label>大小 ({store.text.fontSize}px)</Label>
                 <ResetButton onClick={() => store.updateText({ fontSize: 250 })} />
              </div>
              <Slider
                value={[store.text.fontSize]}
                min={12}
                max={pct(1.5)}
                step={1}
                onValueChange={(v) => store.updateText({ fontSize: v[0] })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="text-auto-fit">自动适应</Label>
              <Switch
                id="text-auto-fit"
                checked={store.text.autoFit}
                onCheckedChange={(checked) => store.updateText({ autoFit: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
               <Label>颜色</Label>
               <ColorPicker color={store.text.color} onChange={(c) => store.updateText({ color: c })} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>透明度 ({Math.round(store.text.opacity * 100)}%)</Label>
                <ResetButton onClick={() => store.updateText({ opacity: 0.5 })} />
              </div>
              <Slider
                value={[store.text.opacity]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={(value) => store.updateText({ opacity: value[0] })}
              />
            </div>

            <div className="space-y-2">
               <div className="flex justify-between items-center">
                   <Label>描边宽度</Label>
                   <ResetButton onClick={() => store.updateText({ strokeWidth: 0 })} />
               </div>
               <Slider
                 value={[store.text.strokeWidth]}
                 min={0}
                 max={pct(0.01)}
                 step={0.5}
                 onValueChange={(v) => store.updateText({ strokeWidth: v[0] })}
               />
            </div>

             <div className="flex items-center justify-between">
               <Label>描边颜色</Label>
               <ColorPicker color={store.text.strokeColor} onChange={(c) => store.updateText({ strokeColor: c })} />
            </div>

            <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
                <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-semibold">文字错位 / 分离</Label>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => store.updateText({
                            leftOffsetX: 22,
                            leftOffsetY: 0,
                            rightOffsetX: -22,
                            rightOffsetY: 0,
                            leftAlign: 'center',
                            rightAlign: 'center',
                        })}
                    >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        重置
                    </Button>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-semibold">左侧文字</Label>
                    <div className="flex items-center justify-between">
                        <Label className="text-[10px] text-muted-foreground">对齐</Label>
                        <div className="flex gap-1">
                            {(['left', 'center', 'right'] as const).map((a) => {
                                const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight;
                                return (
                                    <Button
                                        key={a}
                                        variant={store.text.leftAlign === a ? 'default' : 'outline'}
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => store.updateText({ leftAlign: a })}
                                    >
                                        <Icon className="h-3 w-3" />
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="flex-1">
                            <SliderWithInput
                                label="水平偏移"
                                value={store.text.leftOffsetX}
                                min={-pct(0.3)}
                                max={pct(0.3)}
                                onChange={(v) => handleLeftOffsetChange('x', v)}
                            />
                        </div>
                        <div className="flex flex-col items-center gap-0.5 mt-4">
                            <button
                                className="p-0.5 rounded hover:bg-accent"
                                onClick={() => toggleLock('offsetX')}
                                title={lockedAxes.offsetX ? '已锁定：左右水平同步' : '未锁定'}
                            >
                                {lockedAxes.offsetX ? <Lock className="h-3.5 w-3.5 text-primary" /> : <Unlock className="h-3.5 w-3.5 text-muted-foreground" />}
                            </button>
                            {lockedAxes.offsetX && (
                                <button
                                    className="p-0.5 rounded hover:bg-accent"
                                    onClick={() => toggleLockMode('offsetX')}
                                    title={lockMode.offsetX ? '正正：同向移动' : '正反：镜像移动'}
                                >
                                    {lockMode.offsetX
                                        ? <MoveRight className="h-3 w-3 text-primary" />
                                        : <ArrowLeftRight className="h-3 w-3 text-primary" />}
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="flex-1">
                            <SliderWithInput
                                label="垂直偏移"
                                value={store.text.leftOffsetY}
                                min={-pct(0.3)}
                                max={pct(0.3)}
                                onChange={(v) => handleLeftOffsetChange('y', v)}
                            />
                        </div>
                        <div className="flex flex-col items-center gap-0.5 mt-4">
                            <button
                                className="p-0.5 rounded hover:bg-accent"
                                onClick={() => toggleLock('offsetY')}
                                title={lockedAxes.offsetY ? '已锁定：左右垂直同步' : '未锁定'}
                            >
                                {lockedAxes.offsetY ? <Lock className="h-3.5 w-3.5 text-primary" /> : <Unlock className="h-3.5 w-3.5 text-muted-foreground" />}
                            </button>
                            {lockedAxes.offsetY && (
                                <button
                                    className="p-0.5 rounded hover:bg-accent"
                                    onClick={() => toggleLockMode('offsetY')}
                                    title={lockMode.offsetY ? '正正：同向移动' : '正反：镜像移动'}
                                >
                                    {lockMode.offsetY
                                        ? <MoveRight className="h-3 w-3 text-primary" />
                                        : <ArrowLeftRight className="h-3 w-3 text-primary" />}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-dashed">
                    <Label className="text-xs font-semibold">右侧文字</Label>
                    <div className="flex items-center justify-between">
                        <Label className="text-[10px] text-muted-foreground">对齐</Label>
                        <div className="flex gap-1">
                            {(['left', 'center', 'right'] as const).map((a) => {
                                const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight;
                                return (
                                    <Button
                                        key={a}
                                        variant={store.text.rightAlign === a ? 'default' : 'outline'}
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => store.updateText({ rightAlign: a })}
                                    >
                                        <Icon className="h-3 w-3" />
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="flex-1">
                            <SliderWithInput
                                label="水平偏移"
                                value={store.text.rightOffsetX}
                                min={-pct(0.3)}
                                max={pct(0.3)}
                                onChange={(v) => handleRightOffsetChange('x', v)}
                            />
                        </div>
                        <div className="flex flex-col items-center gap-0.5 mt-4">
                            <button
                                className="p-0.5 rounded hover:bg-accent"
                                onClick={() => toggleLock('offsetX')}
                                title={lockedAxes.offsetX ? '已锁定：左右水平同步' : '未锁定'}
                            >
                                {lockedAxes.offsetX ? <Lock className="h-3.5 w-3.5 text-primary" /> : <Unlock className="h-3.5 w-3.5 text-muted-foreground" />}
                            </button>
                            {lockedAxes.offsetX && (
                                <button
                                    className="p-0.5 rounded hover:bg-accent"
                                    onClick={() => toggleLockMode('offsetX')}
                                    title={lockMode.offsetX ? '正正：同向移动' : '正反：镜像移动'}
                                >
                                    {lockMode.offsetX
                                        ? <MoveRight className="h-3 w-3 text-primary" />
                                        : <ArrowLeftRight className="h-3 w-3 text-primary" />}
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="flex-1">
                            <SliderWithInput
                                label="垂直偏移"
                                value={store.text.rightOffsetY}
                                min={-pct(0.3)}
                                max={pct(0.3)}
                                onChange={(v) => handleRightOffsetChange('y', v)}
                            />
                        </div>
                        <div className="flex flex-col items-center gap-0.5 mt-4">
                            <button
                                className="p-0.5 rounded hover:bg-accent"
                                onClick={() => toggleLock('offsetY')}
                                title={lockedAxes.offsetY ? '已锁定：左右垂直同步' : '未锁定'}
                            >
                                {lockedAxes.offsetY ? <Lock className="h-3.5 w-3.5 text-primary" /> : <Unlock className="h-3.5 w-3.5 text-muted-foreground" />}
                            </button>
                            {lockedAxes.offsetY && (
                                <button
                                    className="p-0.5 rounded hover:bg-accent"
                                    onClick={() => toggleLockMode('offsetY')}
                                    title={lockMode.offsetY ? '正正：同向移动' : '正反：镜像移动'}
                                >
                                    {lockMode.offsetY
                                        ? <MoveRight className="h-3 w-3 text-primary" />
                                        : <ArrowLeftRight className="h-3 w-3 text-primary" />}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
               <div className="flex justify-between items-center">
                   <Label>旋转 ({store.text.rotation}°)</Label>
                   <ResetButton onClick={() => store.updateText({ rotation: 0 })} />
               </div>
               <Slider 
                 value={[store.text.rotation]} 
                 min={0} 
                 max={360} 
                 step={1} 
                 onValueChange={(v) => store.updateText({ rotation: v[0] })} 
               />
            </div>
          </section>

          <Separator />

          {/* Icon Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">图标设置</h3>
              <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="复位图标位置"
                    onClick={() => store.updateIcon({ x: 0, y: 0 })}
                >
                    <RotateCcw className="h-3 w-3" />
                </Button>
                <Switch
                  checked={store.icon.visible}
                  onCheckedChange={(c) => store.updateIcon({ visible: c })}
                />
              </div>
            </div>

            {store.icon.visible && (<>
            <div className="flex items-center justify-between">
                <Label>图标层级</Label>
                <div className="flex gap-1">
                    {([
                        { value: 'left', label: '左侧' },
                        { value: 'front', label: '前面' },
                        { value: 'behind', label: '后面' },
                        { value: 'right', label: '右侧' },
                    ] as const).map((opt) => (
                        <Button
                            key={opt.value}
                            variant={store.icon.placement === opt.value ? 'default' : 'outline'}
                            size="sm"
                            className="h-6 text-[10px] px-2"
                            onClick={() => store.updateIcon({ placement: opt.value })}
                        >
                            {opt.label}
                        </Button>
                    ))}
                </div>
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="picker">选择图标</TabsTrigger>
                    <TabsTrigger value="upload">上传图标</TabsTrigger>
                </TabsList>
                
                <TabsContent value="picker" className="space-y-2 mt-2">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>搜索图标</Label>
                        <a 
                            href="https://yesicon.app/" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[10px] text-muted-foreground flex items-center hover:text-primary hover:underline"
                        >
                            查找图标名称 <ExternalLink className="w-3 h-3 ml-0.5" />
                        </a>
                      </div>
                      <IconPicker 
                        value={store.icon.name} 
                        onChange={(v) => {
                            store.updateIcon({ name: v, customIconUrl: undefined }); // Clear custom icon when picking new one
                        }} 
                      />
                      <div className="text-center pt-1">
                          <button 
                            className="text-[10px] text-muted-foreground hover:text-primary hover:underline cursor-pointer"
                            onClick={() => setActiveTab('upload')}
                          >
                            没有找到想要的？手动上传！
                          </button>
                      </div>
                    </div>
                </TabsContent>
                
                <TabsContent value="upload" className="space-y-2 mt-2">
                    <div className="space-y-2">
                        <Label>上传图片</Label>
                        <Input type="file" accept="image/*" onChange={handleIconUpload} />
                        {store.icon.customIconUrl && (
                            <>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-xs">图片圆角 ({store.icon.customIconRadius}%)</Label>
                                        <ResetButton onClick={() => store.updateIcon({ customIconRadius: 0 })} />
                                    </div>
                                    <Slider
                                        value={[store.icon.customIconRadius]}
                                        min={0}
                                        max={100}
                                        step={1}
                                        onValueChange={(v) => store.updateIcon({ customIconRadius: v[0] })}
                                    />
                                </div>

                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full text-xs"
                                    onClick={() => store.updateIcon({ customIconUrl: undefined })}
                                >
                                    清除自定义图标 (使用默认图标)
                                </Button>
                            </>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            <div className="space-y-2">
               <div className="flex justify-between items-center">
                   <Label>大小 ({store.icon.size}px)</Label>
                   <ResetButton onClick={() => store.updateIcon({ size: 300 })} />
               </div>
               <Slider
                 value={[store.icon.size]}
                 min={20}
                 max={pct(1.5)}
                 step={5}
                 onValueChange={(v) => store.updateIcon({ size: v[0] })}
               />
            </div>

            <SliderWithInput
                label={`水平位置 (${store.icon.x})`}
                value={store.icon.x}
                min={-pct(0.5)}
                max={pct(0.5)}
                onChange={(v) => store.updateIcon({ x: v })}
            />
            <SliderWithInput
                label={`垂直位置 (${store.icon.y})`}
                value={store.icon.y}
                min={-pct(0.5)}
                max={pct(0.5)}
                onChange={(v) => store.updateIcon({ y: v })}
            />

            <div className="space-y-2">
               <div className="flex justify-between items-center">
                   <Label>旋转 ({store.icon.rotation}°)</Label>
                   <ResetButton onClick={() => store.updateIcon({ rotation: 0 })} />
               </div>
               <Slider 
                 value={[store.icon.rotation]} 
                 min={0} 
                 max={360} 
                 step={1} 
                 onValueChange={(v) => store.updateIcon({ rotation: v[0] })} 
               />
            </div>

            <div className="flex items-center justify-between">
               <Label>图标着色</Label>
               <ColorPicker color={store.icon.color} onChange={(c) => store.updateIcon({ color: c })} />
            </div>

             <div className="flex items-center justify-between">
              <Label htmlFor="icon-shadow">阴影</Label>
              <Switch 
                id="icon-shadow" 
                checked={store.icon.shadow} 
                onCheckedChange={(c) => store.updateIcon({ shadow: c })} 
              />
            </div>

            {store.icon.shadow && (
                <div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
                    <div className="flex items-center justify-between">
                       <Label className="text-xs">阴影颜色</Label>
                       <ColorPicker color={store.icon.shadowColor} onChange={(c) => store.updateIcon({ shadowColor: c })} />
                    </div>
                    
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                            <Label className="text-xs">模糊 ({store.icon.shadowBlur}px)</Label>
                            <ResetButton onClick={() => store.updateIcon({ shadowBlur: 40 })} />
                        </div>
                        <Slider
                            value={[store.icon.shadowBlur]}
                            min={0}
                            max={pct(0.1)}
                            step={1}
                            onValueChange={(v) => store.updateIcon({ shadowBlur: v[0] })}
                        />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                            <Label className="text-xs">垂直偏移 ({store.icon.shadowOffsetY}px)</Label>
                            <ResetButton onClick={() => store.updateIcon({ shadowOffsetY: 12 })} />
                        </div>
                        <Slider
                            value={[store.icon.shadowOffsetY]}
                            min={-pct(0.05)}
                            max={pct(0.05)}
                            step={1}
                            onValueChange={(v) => store.updateIcon({ shadowOffsetY: v[0] })}
                        />
                    </div>
                </div>
            )}

            <Separator className="my-2"/>
            
            <div className="space-y-2">
                <Label>图标容器形状</Label>
                <Select value={store.icon.bgShape} onValueChange={(v) => store.updateIcon({ bgShape: v as any })}>
                    <SelectTrigger>
                        <SelectValue placeholder="容器形状" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">无</SelectItem>
                        <SelectItem value="circle">圆形</SelectItem>
                        <SelectItem value="square">方形</SelectItem>
                        <SelectItem value="rounded-square">圆角矩形</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {store.icon.bgShape !== 'none' && (
                <>
                    <div className="flex items-center justify-between">
                        <Label>容器颜色</Label>
                        <ColorPicker color={store.icon.bgColor} onChange={(c) => store.updateIcon({ bgColor: c })} />
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label>内边距 ({store.icon.padding}%)</Label>
                            <ResetButton onClick={() => store.updateIcon({ padding: 5 })} />
                        </div>
                        <Slider
                            value={[store.icon.padding]}
                            min={0}
                            max={100}
                            step={1}
                            onValueChange={(v) => store.updateIcon({ padding: v[0] })}
                        />
                    </div>
                    {store.icon.bgShape === 'rounded-square' && (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label>容器圆角 ({store.icon.radius}%)</Label>
                                <ResetButton onClick={() => store.updateIcon({ radius: 44 })} />
                            </div>
                            <Slider
                                value={[store.icon.radius]}
                                min={0}
                                max={100}
                                step={1}
                                onValueChange={(v) => store.updateIcon({ radius: v[0] })}
                            />
                        </div>
                    )}
                    
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label>容器透明度 ({(store.icon.bgOpacity * 100).toFixed(0)}%)</Label>
                            <ResetButton onClick={() => store.updateIcon({ bgOpacity: 0.08 })} />
                        </div>
                        <Slider 
                            value={[store.icon.bgOpacity]} 
                            min={0} 
                            max={1} 
                            step={0.01} 
                            onValueChange={(v) => store.updateIcon({ bgOpacity: v[0] })} 
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label>容器模糊 ({(store.icon.bgBlur)}px)</Label>
                            <ResetButton onClick={() => store.updateIcon({ bgBlur: 22 })} />
                        </div>
                        <Slider
                            value={[store.icon.bgBlur]}
                            min={0}
                            max={pct(0.05)}
                            step={1}
                            onValueChange={(v) => store.updateIcon({ bgBlur: v[0] })}
                        />
                    </div>
                </>
            )}
            </>)}
          </section>

          <Separator />

          {/* Background Section */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">背景设置</h3>
            
            <Tabs value={store.background.type} onValueChange={(v) => store.updateBackground({ type: v as 'solid' | 'image' | 'auto' })}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="solid">纯色背景</TabsTrigger>
                    <TabsTrigger value="image">图片背景</TabsTrigger>
                    <TabsTrigger value="auto">自动取色</TabsTrigger>
                </TabsList>
                
                <TabsContent value="solid" className="space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                        <Label>颜色</Label>
                        <ColorPicker color={store.background.color} onChange={(c) => store.updateBackground({ color: c })} />
                    </div>
                </TabsContent>
                
                <TabsContent value="image" className="space-y-2 mt-2">
                     <Input type="file" accept="image/*" onChange={handleImageUpload} />
                     
                     <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label>高斯模糊 ({store.background.blur}px)</Label>
                            <ResetButton onClick={() => store.updateBackground({ blur: 0 })} />
                        </div>
                        <Slider
                            value={[store.background.blur]}
                            min={0}
                            max={pct(0.05)}
                            step={1}
                            onValueChange={(v) => store.updateBackground({ blur: v[0] })}
                        />
                    </div>
                    
                    <div className="space-y-2 pt-2 border-t">
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                            <Label className="text-xs font-semibold text-muted-foreground w-full mb-1">图片变换</Label>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-xs flex-1"
                                onClick={() => handleFit('contain')}
                            >
                                <Maximize className="w-3 h-3 mr-1" />
                                适应
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-xs flex-1"
                                onClick={() => handleFit('cover')}
                            >
                                <Maximize className="w-3 h-3 mr-1 rotate-90" />
                                铺满
                            </Button>
                        </div>
                        
                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <Label className="text-xs">缩放 ({store.background.scale.toFixed(1)}x)</Label>
                                <ResetButton onClick={() => store.updateBackground({ scale: 1 })} />
                            </div>
                            <Slider 
                                value={[store.background.scale]} 
                                min={0.1} 
                                max={10} 
                                step={0.1} 
                                onValueChange={(v) => store.updateBackground({ scale: v[0] })} 
                            />
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <Label className="text-xs">水平位置 ({store.background.positionX}%)</Label>
                                <ResetButton onClick={() => store.updateBackground({ positionX: 50 })} />
                            </div>
                            <Slider 
                                value={[store.background.positionX]} 
                                min={-500} 
                                max={500} 
                                step={1} 
                                onValueChange={(v) => store.updateBackground({ positionX: v[0] })} 
                            />
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <Label className="text-xs">垂直位置 ({store.background.positionY}%)</Label>
                                <ResetButton onClick={() => store.updateBackground({ positionY: 50 })} />
                            </div>
                            <Slider 
                                value={[store.background.positionY]} 
                                min={-500} 
                                max={500} 
                                step={1} 
                                onValueChange={(v) => store.updateBackground({ positionY: v[0] })} 
                            />
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <Label className="text-xs">旋转 ({store.background.rotation}°)</Label>
                                <ResetButton onClick={() => store.updateBackground({ rotation: 0 })} />
                            </div>
                            <Slider 
                                value={[store.background.rotation]} 
                                min={0} 
                                max={360} 
                                step={1} 
                                onValueChange={(v) => store.updateBackground({ rotation: v[0] })} 
                            />
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="auto" className="mt-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-between gap-2 rounded-md border p-2">
                            <Label className="text-xs">主色</Label>
                            <span
                                className="size-6 shrink-0 rounded-sm border"
                                style={{ backgroundColor: store.background.autoPrimary }}
                                title={store.background.autoPrimary}
                            />
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-md border p-2">
                            <Label className="text-xs">浅色</Label>
                            <span
                                className="size-6 shrink-0 rounded-sm border"
                                style={{ backgroundColor: store.background.autoSecondary }}
                                title={store.background.autoSecondary}
                            />
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            <div className="flex items-center justify-between mt-2">
              <Label htmlFor="bg-shadow">背景阴影</Label>
              <Switch 
                id="bg-shadow" 
                checked={store.background.shadow} 
                onCheckedChange={(c) => store.updateBackground({ shadow: c })} 
              />
            </div>

            {store.background.shadow && (
                <div className="space-y-2 p-3 bg-muted/30 rounded-lg border mt-2">
                    <div className="flex items-center justify-between">
                       <Label className="text-xs">阴影颜色</Label>
                       <ColorPicker color={store.background.shadowColor} onChange={(c) => store.updateBackground({ shadowColor: c })} />
                    </div>
                    
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                            <Label className="text-xs">模糊 ({store.background.shadowBlur}px)</Label>
                            <ResetButton onClick={() => store.updateBackground({ shadowBlur: 30 })} />
                        </div>
                        <Slider
                            value={[store.background.shadowBlur]}
                            min={0}
                            max={pct(0.2)}
                            step={1}
                            onValueChange={(v) => store.updateBackground({ shadowBlur: v[0] })}
                        />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                            <Label className="text-xs">垂直偏移 ({store.background.shadowOffsetY}px)</Label>
                            <ResetButton onClick={() => store.updateBackground({ shadowOffsetY: 10 })} />
                        </div>
                        <Slider
                            value={[store.background.shadowOffsetY]}
                            min={-pct(0.1)}
                            max={pct(0.1)}
                            step={1}
                            onValueChange={(v) => store.updateBackground({ shadowOffsetY: v[0] })}
                        />
                    </div>
                </div>
            )}
          </section>

        </div>
      </ScrollArea>
      </div>

      <div className="p-4 border-t bg-gray-50 dark:bg-gray-950 space-y-4">
         <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${Object.values(supportedExportFormats).filter(Boolean).length}, minmax(0, 1fr))`,
            }}
         >
            {(Object.keys(supportedExportFormats) as ExportFormat[])
              .filter((format) => supportedExportFormats[format])
              .map((format) => (
                <Button
                  key={format}
                  variant="default"
                  className="min-w-0 px-2"
                  disabled={exportingFormat !== null}
                  onClick={() => handleExport(format)}
                  title={`导出 ${format.toUpperCase()}`}
                >
                  {exportingFormat === format ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  <span>{format.toUpperCase()}</span>
                </Button>
              ))}
         </div>
         
         <div className="text-center text-xs text-muted-foreground">
            <a href="https://github.com/zylunx/EasyCoverPlus" target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center justify-center gap-1">
                <Github className="w-4 h-4" />
                GitHub 开源仓库
            </a>
         </div>
      </div>
    </div>
  );
}
