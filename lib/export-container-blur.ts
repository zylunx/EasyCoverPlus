export interface ContainerBlurGeometry {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotation: number;
  shape: 'circle' | 'square' | 'rounded-square';
  radiusPercent: number;
  blur: number;
}

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const blurCanvasWithContextFilter = (
  source: HTMLCanvasElement,
  radius: number,
): HTMLCanvasElement | null => {
  const output = createCanvas(source.width, source.height);
  const context = output.getContext('2d');
  if (!context || !('filter' in context)) return null;

  context.filter = `blur(${radius}px)`;
  // Some browsers expose the property but reject unsupported filter values.
  if (context.filter === 'none') return null;
  context.drawImage(source, 0, 0);
  context.filter = 'none';
  return output;
};

const boxBlurPass = (
  source: Uint8ClampedArray,
  target: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  horizontal: boolean,
) => {
  const size = radius * 2 + 1;
  const primaryLength = horizontal ? width : height;
  const secondaryLength = horizontal ? height : width;

  for (let secondary = 0; secondary < secondaryLength; secondary += 1) {
    const sums = [0, 0, 0, 0];

    const sourceIndex = (primary: number) => {
      const x = horizontal ? primary : secondary;
      const y = horizontal ? secondary : primary;
      return (y * width + x) * 4;
    };

    for (let offset = -radius; offset <= radius; offset += 1) {
      const index = sourceIndex(Math.min(primaryLength - 1, Math.max(0, offset)));
      sums[0] += source[index];
      sums[1] += source[index + 1];
      sums[2] += source[index + 2];
      sums[3] += source[index + 3];
    }

    for (let primary = 0; primary < primaryLength; primary += 1) {
      const index = sourceIndex(primary);
      target[index] = Math.round(sums[0] / size);
      target[index + 1] = Math.round(sums[1] / size);
      target[index + 2] = Math.round(sums[2] / size);
      target[index + 3] = Math.round(sums[3] / size);

      const removeIndex = sourceIndex(Math.max(0, primary - radius));
      const addIndex = sourceIndex(Math.min(primaryLength - 1, primary + radius + 1));
      sums[0] += source[addIndex] - source[removeIndex];
      sums[1] += source[addIndex + 1] - source[removeIndex + 1];
      sums[2] += source[addIndex + 2] - source[removeIndex + 2];
      sums[3] += source[addIndex + 3] - source[removeIndex + 3];
    }
  }
};

// CanvasRenderingContext2D.filter is still absent in some Safari releases.
// Three box-blur passes approximate a Gaussian while keeping the fallback O(n).
const blurCanvasWithImageData = (source: HTMLCanvasElement, radius: number) => {
  const output = createCanvas(source.width, source.height);
  const context = output.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D is unavailable');

  context.drawImage(source, 0, 0);
  const imageData = context.getImageData(0, 0, source.width, source.height);
  let current = new Uint8ClampedArray(imageData.data);
  let scratch = new Uint8ClampedArray(current.length);
  // Three equal box passes have a combined standard deviation close to their
  // radius, which tracks the CSS blur radius closely.
  const boxRadius = Math.max(1, Math.round(radius));

  for (let pass = 0; pass < 3; pass += 1) {
    boxBlurPass(current, scratch, source.width, source.height, boxRadius, true);
    [current, scratch] = [scratch, current];
    boxBlurPass(current, scratch, source.width, source.height, boxRadius, false);
    [current, scratch] = [scratch, current];
  }

  imageData.data.set(current);
  context.putImageData(imageData, 0, 0);
  return output;
};

const createBlurredCanvas = (source: HTMLCanvasElement, radius: number) => (
  blurCanvasWithContextFilter(source, radius)
  ?? blurCanvasWithImageData(source, radius)
);

const getBlurSampleBounds = (
  canvas: HTMLCanvasElement,
  geometry: ContainerBlurGeometry,
) => {
  const radians = geometry.rotation * Math.PI / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  const halfWidth = (geometry.width * cosine + geometry.height * sine) / 2;
  const halfHeight = (geometry.width * sine + geometry.height * cosine) / 2;
  // Both the native filter and the three-pass fallback can sample pixels up to
  // roughly three radii away. Keeping that margin avoids seams at crop edges.
  const margin = Math.max(2, Math.ceil(geometry.blur * 3));
  const left = Math.max(0, Math.floor(geometry.centerX - halfWidth - margin));
  const top = Math.max(0, Math.floor(geometry.centerY - halfHeight - margin));
  const right = Math.min(canvas.width, Math.ceil(geometry.centerX + halfWidth + margin));
  const bottom = Math.min(canvas.height, Math.ceil(geometry.centerY + halfHeight + margin));

  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
};

const addRoundedRectPath = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const safeRadius = Math.min(Math.max(radius, 0), width / 2, height / 2);
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
};

const clipContainer = (
  context: CanvasRenderingContext2D,
  geometry: ContainerBlurGeometry,
) => {
  const x = -geometry.width / 2;
  const y = -geometry.height / 2;
  context.beginPath();

  if (geometry.shape === 'circle') {
    context.ellipse(0, 0, geometry.width / 2, geometry.height / 2, 0, 0, Math.PI * 2);
  } else if (geometry.shape === 'rounded-square') {
    const radius = Math.min(geometry.width, geometry.height) * geometry.radiusPercent / 200;
    addRoundedRectPath(context, x, y, geometry.width, geometry.height, radius);
  } else {
    context.rect(x, y, geometry.width, geometry.height);
  }

  context.closePath();
  context.clip();
};

export const compositeContainerBlur = (
  backdrop: HTMLCanvasElement,
  iconLayer: HTMLCanvasElement,
  foregroundLayer: HTMLCanvasElement | null,
  geometry: ContainerBlurGeometry,
) => {
  const output = createCanvas(backdrop.width, backdrop.height);
  const context = output.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');

  context.drawImage(backdrop, 0, 0);

  const sampleBounds = getBlurSampleBounds(backdrop, geometry);
  if (sampleBounds.width === 0 || sampleBounds.height === 0) {
    context.drawImage(iconLayer, 0, 0);
    if (foregroundLayer) context.drawImage(foregroundLayer, 0, 0);
    return output;
  }

  // Blurring the full export canvas is needlessly expensive, particularly in
  // Safari where the ImageData fallback runs on the main thread. Only pixels
  // that can influence the container are copied and processed.
  const sample = createCanvas(sampleBounds.width, sampleBounds.height);
  const sampleContext = sample.getContext('2d');
  if (!sampleContext) throw new Error('Canvas 2D is unavailable');
  sampleContext.drawImage(
    backdrop,
    sampleBounds.left,
    sampleBounds.top,
    sampleBounds.width,
    sampleBounds.height,
    0,
    0,
    sampleBounds.width,
    sampleBounds.height,
  );
  const blurred = createBlurredCanvas(sample, geometry.blur);

  context.save();
  context.translate(geometry.centerX, geometry.centerY);
  context.rotate(geometry.rotation * Math.PI / 180);
  clipContainer(context, geometry);
  context.rotate(-geometry.rotation * Math.PI / 180);
  context.translate(-geometry.centerX, -geometry.centerY);
  context.drawImage(blurred, sampleBounds.left, sampleBounds.top);
  context.restore();

  context.drawImage(iconLayer, 0, 0);
  if (foregroundLayer) context.drawImage(foregroundLayer, 0, 0);
  return output;
};
