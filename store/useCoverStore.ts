import { create } from 'zustand';

export type AspectRatio = '1200×630' | '1:1' | '16:9' | '21:9' | '4:3' | '2:1';

export const RATIOS: { label: AspectRatio; width: number; height: number }[] = [
  { label: '1200×630', width: 1200, height: 630 },
  { label: '1:1', width: 900, height: 900 },
  { label: '16:9', width: 1600, height: 900 },
  { label: '21:9', width: 2100, height: 900 },
  { label: '4:3', width: 1200, height: 900 },
  { label: '2:1', width: 1800, height: 900 },
];

interface TextSettings {
  fontSize: number;
  color: string;
  opacity: number;
  autoFit: boolean;
  strokeColor: string;
  strokeWidth: number;
  fontWeight: number;
  rotation: number;
  // Font settings
  font: string;
  // Split content (left/right of the canvas centerline)
  leftContent: string;
  rightContent: string;
  leftAlign: 'left' | 'center' | 'right';
  rightAlign: 'left' | 'center' | 'right';
  leftOffsetX: number;
  leftOffsetY: number;
  rightOffsetX: number;
  rightOffsetY: number;
}

interface IconSettings {
  visible: boolean;
  placement: 'front' | 'behind' | 'left' | 'right';
  name: string; // identifier for the icon
  size: number;
  color: string; // useful if we allow tinting, even for colored icons
  shadow: boolean;
  x: number;
  y: number;
  rotation: number;
  // New settings for "Card/Box" style icon
  bgShape: 'none' | 'circle' | 'square' | 'rounded-square';
  bgColor: string;
  padding: number;
  radius: number; // For rounded-square custom radius
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetY: number;
  // Transparency and Blur for container
  bgOpacity: number; // 0-1
  bgBlur: number; // px
  // Custom image icon
  customIconUrl?: string;
  customIconRadius: number; // For custom image icon radius
}

interface BackgroundSettings {
  type: 'solid' | 'image' | 'auto';
  color: string;
  autoPrimary: string;
  autoSecondary: string;
  imageUrl: string;
  blur: number; // 0-100
  radius: number; // 0-100
  shadow: boolean;
  opacity: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetY: number;
  // Image transform settings
  scale: number;
  positionX: number;
  positionY: number;
  rotation: number;
}

interface CoverState {
  selectedRatios: AspectRatio[];
  showRuler: boolean;
  text: TextSettings;
  icon: IconSettings;
  background: BackgroundSettings;

  // Actions
  toggleRatio: (ratio: AspectRatio) => void;
  setShowRuler: (show: boolean) => void;
  updateText: (settings: Partial<TextSettings>) => void;
  updateIcon: (settings: Partial<IconSettings>) => void;
  updateBackground: (settings: Partial<BackgroundSettings>) => void;
}

export const useCoverStore = create<CoverState>((set) => ({
  selectedRatios: ['1200×630'],
  showRuler: false,
  text: {
    fontSize: 250,
    color: '#ffffff',
    opacity: 0.5,
    autoFit: true,
    strokeColor: '#ffffff',
    strokeWidth: 0,
    fontWeight: 800,
    rotation: 0,
    font: 'Inter, sans-serif',
    leftContent: 'B站',
    rightContent: '推荐',
    leftAlign: 'center',
    rightAlign: 'center',
    leftOffsetX: 22,
    leftOffsetY: 0,
    rightOffsetX: -22,
    rightOffsetY: 0,
  },
  icon: {
    visible: true,
    placement: 'front',
    name: 'streamline-logos:bilibili-logo-block',
    size: 300,
    color: '#fb7299',
    shadow: true,
    x: 0,
    y: 0,
    rotation: 0,
    bgShape: 'rounded-square', // Default to a nice card look
    bgColor: '#ffffff',
    padding: 5,
    radius: 44,
    shadowColor: 'rgba(0,0,0,0.15)',
    shadowBlur: 40,
    shadowOffsetY: 12,
    bgOpacity: 0.08,
    bgBlur: 22,
    customIconRadius: 0,
  },
  background: {
    type: 'auto',
    color: '#f3f4f6',
    autoPrimary: '#d94a72',
    autoSecondary: '#e59aae',
    imageUrl: '',
    blur: 0,
    radius: 0,
    shadow: false,
    opacity: 1,
    shadowColor: 'rgba(0,0,0,0.3)',
    shadowBlur: 30,
    shadowOffsetY: 10,
    scale: 1,
    positionX: 50,
    positionY: 50,
    rotation: 0,
  },

  toggleRatio: (ratio) =>
    set((state) => {
      const exists = state.selectedRatios.includes(ratio);
      if (exists && state.selectedRatios.length === 1) return state; // Prevent empty
      return {
        selectedRatios: exists
          ? state.selectedRatios.filter((r) => r !== ratio)
          : [...state.selectedRatios, ratio],
      };
    }),
  setShowRuler: (show) => set({ showRuler: show }),
  updateText: (settings) =>
    set((state) => ({ text: { ...state.text, ...settings } })),
  updateIcon: (settings) =>
    set((state) => ({ icon: { ...state.icon, ...settings } })),
  updateBackground: (settings) =>
    set((state) => ({ background: { ...state.background, ...settings } })),
}));
