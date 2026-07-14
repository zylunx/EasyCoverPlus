'use client';

import React, { useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { useCoverStore, RATIOS } from '@/store/useCoverStore';
import { Icon } from '@iconify/react';
import { extractAutoGradient } from '@/lib/color-extraction';

interface FittedTextProps {
  content: string;
  maxFontSize: number;
  autoFit: boolean;
  offsetX: number;
  offsetY: number;
  rotation: number;
  color: string;
  opacity: number;
  fontWeight: number;
  fontFamily: string;
  align: 'left' | 'center' | 'right';
  strokeWidth: number;
  strokeColor: string;
}

function FittedText({
  content,
  maxFontSize,
  autoFit,
  offsetX,
  offsetY,
  rotation,
  color,
  opacity,
  fontWeight,
  fontFamily,
  align,
  strokeWidth,
  strokeColor,
}: FittedTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const element = textRef.current;
    if (!container || !element) return;

    const fit = () => {
      element.style.fontSize = `${maxFontSize}px`;
      if (!autoFit) return;

      const availableWidth = Math.max(container.clientWidth - 32, 1);
      const naturalWidth = element.scrollWidth;
      if (naturalWidth > availableWidth) {
        element.style.fontSize = `${Math.max(12, maxFontSize * availableWidth / naturalWidth)}px`;
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, [autoFit, content, fontFamily, fontWeight, maxFontSize]);

  return (
    <div
      ref={containerRef}
      className="w-full min-w-0"
      style={{
        transform: `translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg)`,
        color,
        opacity,
        fontWeight,
        fontFamily,
        textAlign: align,
      }}
    >
      <span
        ref={textRef}
        className="inline-block whitespace-pre leading-tight"
        style={{
          fontSize: `${maxFontSize}px`,
          WebkitTextStroke: strokeWidth > 0 ? `${strokeWidth}px ${strokeColor}` : undefined,
        }}
      >
        {content}
      </span>
    </div>
  );
}

export default function Canvas() {
  const {
    selectedRatios,
    showRuler,
    text,
    icon,
    background,
  } = useCoverStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Calculate the bounding box required for all selected ratios
  const dimensions = useMemo(() => {
    const activeRatios = RATIOS.filter((r) => selectedRatios.includes(r.label));
    if (activeRatios.length === 0) return { width: 1000, height: 1000 };

    const maxWidth = Math.max(...activeRatios.map((r) => r.width));
    const maxHeight = Math.max(...activeRatios.map((r) => r.height));

    return { width: maxWidth, height: maxHeight };
  }, [selectedRatios]);

  // Auto-scale to fit container
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const parent = containerRef.current.parentElement;
      if (!parent) return;

      const isMobile = parent.clientWidth < 768;
      const padding = isMobile ? 16 : 80;
      const availableWidth = parent.clientWidth - padding;
      const availableHeight = parent.clientHeight - padding;

      const scaleX = availableWidth / dimensions.width;
      const scaleY = availableHeight / dimensions.height;
      setScale(Math.min(scaleX, scaleY) * 0.9); 
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dimensions]);

  useEffect(() => {
    if (background.type !== 'auto' || !icon.visible) return;

    let cancelled = false;
    let timeoutId: number | undefined;
    const root = containerRef.current;
    if (!root) return;

    const sampleIcon = async () => {
      const source = root.querySelector<SVGSVGElement | HTMLImageElement>(
        '[data-cover-icon-source] svg, [data-cover-icon-source] img',
      );
      if (!source) return;

      try {
        const colors = await extractAutoGradient(source);
        if (!colors || cancelled) return;
        const current = useCoverStore.getState().background;
        if (
          current.autoPrimary !== colors.primary
          || current.autoSecondary !== colors.secondary
        ) {
          useCoverStore.getState().updateBackground({
            autoPrimary: colors.primary,
            autoSecondary: colors.secondary,
          });
        }
      } catch (error) {
        console.warn('Automatic icon color extraction failed', error);
      }
    };

    const scheduleSample = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(sampleIcon, 30);
    };
    const observer = new MutationObserver(scheduleSample);
    observer.observe(root, { childList: true, subtree: true });
    scheduleSample();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [background.type, icon.color, icon.customIconUrl, icon.name, icon.visible]);

  // Helper to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Helper to render the Icon with its container settings
  const renderIcon = () => {
      const bgColor = icon.bgShape !== 'none' 
        ? hexToRgba(icon.bgColor, icon.bgOpacity)
        : 'transparent';
      
      return (
      <div
          data-cover-icon-source
          className="flex items-center justify-center"
          style={{
              transform: `rotate(${icon.rotation}deg)`,
              filter: icon.shadow ? `drop-shadow(0 ${icon.shadowOffsetY}px ${icon.shadowBlur}px ${icon.shadowColor})` : 'none',
              boxShadow: icon.shadow && background.type === 'auto'
                ? `0 0 ${Math.round(icon.size * 0.28)}px ${hexToRgba(background.autoPrimary, 0.25)}, inset 0 0 ${Math.round(icon.size * 0.22)}px rgba(255,255,255,0.15)`
                : 'none',
              backgroundColor: bgColor,
              backdropFilter: icon.bgBlur > 0 ? `blur(${icon.bgBlur}px)` : 'none',
              WebkitBackdropFilter: icon.bgBlur > 0 ? `blur(${icon.bgBlur}px)` : 'none',
              padding: icon.bgShape !== 'none' ? `${(icon.size * icon.padding) / 100}px` : 0,
              borderRadius: icon.bgShape === 'circle' ? '50%' : icon.bgShape === 'rounded-square' ? `${icon.radius / 2}%` : icon.bgShape === 'square' ? '0' : '0',
          }}
      >
          {icon.customIconUrl ? (
              <img 
                  src={icon.customIconUrl} 
                  alt="Custom Icon" 
                  className="w-full h-full object-contain"
                  style={{
                      width: `${icon.size}px`,
                      height: `${icon.size}px`,
                      borderRadius: `${icon.customIconRadius / 2}%`,
                  }}
              />
          ) : (
              <Icon key={`${icon.name}-${icon.color}`} icon={icon.name} width={icon.size} height={icon.size} color={icon.color} />
          )}
      </div>
      );
  };

  // Helper to render Text
  const renderText = (content: string, offsetX: number = 0, offsetY: number = 0, align: 'left' | 'center' | 'right' = 'center') => (
      <FittedText
        content={content}
        maxFontSize={text.fontSize}
        autoFit={text.autoFit}
        offsetX={offsetX}
        offsetY={offsetY}
        rotation={text.rotation}
        color={text.color}
        opacity={text.opacity}
        fontWeight={text.fontWeight}
        fontFamily={text.font}
        align={align}
        strokeWidth={text.strokeWidth}
        strokeColor={text.strokeColor}
      />
  );

  // Layout: split text anchored to the canvas centerline.
  // Left half hosts left text, right half hosts right text;
  // per-side textAlign controls whether the inner text hugs the centerline.
  const renderAbsoluteIcon = () => icon.visible && (icon.placement === 'front' || icon.placement === 'behind') ? (
      <div
          className="absolute top-1/2 left-1/2"
          style={{
              transform: `translate(calc(-50% + ${icon.x}px), calc(-50% + ${icon.y}px))`,
              zIndex: icon.placement === 'front' ? 20 : 5,
          }}
      >
          {renderIcon()}
      </div>
  ) : null;

  const renderInlineIcon = () => icon.visible ? (
      <div
          className="flex-shrink-0"
          style={{ transform: `translate(${icon.x}px, ${icon.y}px)` }}
      >
          {renderIcon()}
      </div>
  ) : null;

  const isInline = icon.visible && (icon.placement === 'left' || icon.placement === 'right');

  const renderContent = () => (
      <div className="absolute inset-0 pointer-events-none">
          {renderAbsoluteIcon()}
          {isInline ? (
              <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
                  {icon.placement === 'left' && renderInlineIcon()}
                  <div className="flex flex-1 min-w-0 items-center">
                      <div
                          className="w-1/2 min-w-0"
                          style={{
                              justifyContent:
                                  text.leftAlign === 'left' ? 'flex-start' : text.leftAlign === 'right' ? 'flex-end' : 'center',
                              display: 'flex',
                          }}
                      >
                          {renderText(text.leftContent, text.leftOffsetX, text.leftOffsetY, text.leftAlign)}
                      </div>
                      <div
                          className="w-1/2 min-w-0"
                          style={{
                              justifyContent:
                                  text.rightAlign === 'left' ? 'flex-start' : text.rightAlign === 'right' ? 'flex-end' : 'center',
                              display: 'flex',
                          }}
                      >
                          {renderText(text.rightContent, text.rightOffsetX, text.rightOffsetY, text.rightAlign)}
                      </div>
                  </div>
                  {icon.placement === 'right' && renderInlineIcon()}
              </div>
          ) : (
              <>
                  <div
                      className="absolute top-1/2 -translate-y-1/2 flex items-center"
                      style={{
                          left: 0,
                          width: '50%',
                          minWidth: 0,
                          zIndex: 10,
                          justifyContent:
                              text.leftAlign === 'left' ? 'flex-start' : text.leftAlign === 'right' ? 'flex-end' : 'center',
                      }}
                  >
                      {renderText(text.leftContent, text.leftOffsetX, text.leftOffsetY, text.leftAlign)}
                  </div>
                  <div
                      className="absolute top-1/2 -translate-y-1/2 flex items-center"
                      style={{
                          left: '50%',
                          width: '50%',
                          minWidth: 0,
                          zIndex: 10,
                          justifyContent:
                              text.rightAlign === 'left' ? 'flex-start' : text.rightAlign === 'right' ? 'flex-end' : 'center',
                      }}
                  >
                      {renderText(text.rightContent, text.rightOffsetX, text.rightOffsetY, text.rightAlign)}
                  </div>
              </>
          )}
      </div>
  );

  return (
    <div className="bg-gray-100 dark:bg-gray-900 overflow-hidden relative w-full h-[25vh] md:h-full md:flex-1 min-w-0 shrink-0 md:shrink">
      {/* Container for scaling */}
      <div
        ref={containerRef}
        style={{
          width: dimensions.width,
          height: dimensions.height,
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center',
        }}
        className="transition-[width,height] duration-300"
      >
        <div 
            id="canvas-export-target" 
            className="w-full h-full relative overflow-hidden flex flex-col items-center justify-center"
        >
            {/* Background Layer */}
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: background.type === 'solid' ? background.color : '#ffffff',
                backgroundImage: background.type === 'auto'
                  ? `linear-gradient(135deg, ${background.autoPrimary} 0%, ${background.autoSecondary} 100%)`
                  : undefined,
                borderRadius: `${background.radius}px`,
              }}
            >
                {background.type === 'image' && background.imageUrl && (
                    <img 
                        src={background.imageUrl}
                        alt="Background"
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                        style={{
                            filter: `blur(${background.blur}px)`,
                            transform: `scale(${background.scale}) translate(${background.positionX - 50}%, ${background.positionY - 50}%) rotate(${background.rotation}deg)`,
                            transformOrigin: 'center',
                        }}
                    />
                )}
            </div>

            {/* Inner Shadow Layer */}
            {background.shadow && (
                <div 
                    className="absolute inset-0 pointer-events-none z-0"
                    style={{
                        boxShadow: `inset 0 ${background.shadowOffsetY}px ${background.shadowBlur}px ${background.shadowColor}`,
                    }}
                />
            )}

            {/* Content Layer */}
            <div className="z-10 pointer-events-none">
                 {renderContent()}
            </div>

            {/* Overlays / Guides Layer */}
            {selectedRatios.map((ratioLabel) => {
                const ratio = RATIOS.find((r) => r.label === ratioLabel);
                if (!ratio) return null;
                
                // Calculate position to center it
                const left = (dimensions.width - ratio.width) / 2;
                const top = (dimensions.height - ratio.height) / 2;

                return (
                    <div
                        key={ratioLabel}
                        className="absolute border-2 border-dashed border-blue-500/50 pointer-events-none flex items-start justify-start export-exclude"
                        style={{
                            width: ratio.width,
                            height: ratio.height,
                            left: left,
                            top: top,
                            zIndex: 50
                        }}
                    >
                        <span className="bg-blue-500 text-white text-xs px-1 opacity-70">{ratioLabel}</span>
                    </div>
                );
            })}

            {/* Ruler Overlay */}
            {showRuler && (
                <div className="absolute inset-0 pointer-events-none opacity-30 z-40 export-exclude" 
                    style={{ 
                        backgroundImage: 'linear-gradient(90deg, #000 1px, transparent 1px), linear-gradient(0deg, #000 1px, transparent 1px)',
                        backgroundSize: '100px 100px'
                    }}
                />
            )}
        </div>
      </div>
    </div>
  );
}
