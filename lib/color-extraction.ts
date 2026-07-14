export interface AutoGradientColors {
  primary: string;
  secondary: string;
}

type Rgb = [number, number, number];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const componentToHex = (value: number) =>
  Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0');

const rgbToHex = ([r, g, b]: Rgb) =>
  `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;

function rgbToHsl([rValue, gValue, bValue]: Rgb): [number, number, number] {
  const r = rValue / 255;
  const g = gValue / 255;
  const b = bValue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;

  if (max === min) return [0, 0, lightness];

  const delta = max - min;
  const saturation = lightness > 0.5
    ? delta / (2 - max - min)
    : delta / (max + min);
  let hue = 0;

  if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  return [hue / 6, saturation, lightness];
}

function hslToRgb([h, s, l]: [number, number, number]): Rgb {
  if (s === 0) {
    const value = l * 255;
    return [value, value, value];
  }

  const hueToRgb = (p: number, q: number, value: number) => {
    let t = value;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    hueToRgb(p, q, h + 1 / 3) * 255,
    hueToRgb(p, q, h) * 255,
    hueToRgb(p, q, h - 1 / 3) * 255,
  ];
}

export function createReadableGradient(rgb: Rgb): AutoGradientColors {
  const [hue, saturation, lightness] = rgbToHsl(rgb);
  const isNeutral = saturation < 0.08;
  const safeSaturation = isNeutral ? 0 : clamp(saturation, 0.38, 0.78);
  const primaryLightness = isNeutral
    ? clamp(lightness, 0.32, 0.45)
    : clamp(lightness, 0.32, 0.52);
  const secondaryLightness = isNeutral
    ? 0.64
    : clamp(primaryLightness + 0.2, 0.56, 0.7);

  return {
    primary: rgbToHex(hslToRgb([hue, safeSaturation, primaryLightness])),
    secondary: rgbToHex(hslToRgb([
      hue,
      isNeutral ? 0 : safeSaturation * 0.62,
      secondaryLightness,
    ])),
  };
}

function dominantColorFromPixels(data: Uint8ClampedArray): Rgb | null {
  const colorful = new Map<string, { score: number; rgb: Rgb }>();
  const all = new Map<string, { score: number; rgb: Rgb }>();
  let colorfulWeight = 0;
  let totalWeight = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    if (alpha < 0.2) continue;

    const rgb: Rgb = [data[i], data[i + 1], data[i + 2]];
    const [, saturation, lightness] = rgbToHsl(rgb);
    const bucket = rgb.map((value) => Math.round(value / 24) * 24).join(',');
    const weight = alpha;
    const existing = all.get(bucket);
    all.set(bucket, { score: (existing?.score ?? 0) + weight, rgb });
    totalWeight += weight;

    if (saturation >= 0.08 && lightness >= 0.08 && lightness <= 0.94) {
      const colorfulExisting = colorful.get(bucket);
      colorful.set(bucket, {
        score: (colorfulExisting?.score ?? 0) + weight,
        rgb,
      });
      colorfulWeight += weight;
    }
  }

  if (totalWeight === 0) return null;
  const candidates = colorfulWeight / totalWeight >= 0.01 ? colorful : all;
  let winner: { score: number; rgb: Rgb } | null = null;
  for (const candidate of candidates.values()) {
    if (!winner || candidate.score > winner.score) winner = candidate;
  }
  return winner?.rgb ?? null;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Icon image could not be loaded'));
    image.src = source;
  });
}

async function svgToImage(svg: SVGSVGElement): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '128');
  clone.setAttribute('height', '128');
  clone.style.color = getComputedStyle(svg).color;
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: 'image/svg+xml;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);

  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function extractAutoGradient(
  source: SVGSVGElement | HTMLImageElement,
): Promise<AutoGradientColors | null> {
  const image = source instanceof SVGSVGElement ? await svgToImage(source) : source;
  if (image instanceof HTMLImageElement && (!image.complete || image.naturalWidth === 0)) {
    await new Promise<void>((resolve, reject) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => reject(new Error('Icon image could not be loaded')), { once: true });
    });
  }

  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const dominant = dominantColorFromPixels(pixels);
  return dominant ? createReadableGradient(dominant) : null;
}
