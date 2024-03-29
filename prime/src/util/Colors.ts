import { prominent } from 'color.js';

/**
 * Converts an RGB color to a hex color.
 * @param rgb RGB color
 * @returns HSV color
 */
function rgbToHSV(rgb: number[]): number[] {
  // R, G, B values are divided by 255
  // to change the range from 0..255 to 0..1
  const r = rgb[0] / 255.0;
  const g = rgb[1] / 255.0;
  const b = rgb[2] / 255.0;

  // h, s, v = hue, saturation, value
  let cMax = Math.max(r, Math.max(g, b)); // maximum of r, g, b
  let cMin = Math.min(r, Math.min(g, b)); // minimum of r, g, b
  let diff = cMax - cMin; // diff of cmax and cmin.
  let h = -1,
    s = -1;

  // if cmax and cmax are equal then h = 0
  if (cMax === cMin) h = 0;
  // if cmax equal r then compute h
  else if (cMax === r) h = (60 * ((g - b) / diff) + 360) % 360;
  // if cmax equal g then compute h
  else if (cMax === g) h = (60 * ((b - r) / diff) + 120) % 360;
  // if cmax equal b then compute h
  else if (cMax === b) h = (60 * ((r - g) / diff) + 240) % 360;

  // if cmax equal zero
  if (cMax === 0) s = 0;
  else s = (diff / cMax) * 100;

  // compute v
  let v = cMax * 100;
  return [h, s, v];
}

/**
 * Gets the prominent color of a given image.
 * @param path Path to the image
 * @returns The dominant color of the image
 */
export async function getProminentColor(path: string): Promise<string> {
  const colorsRGB: number[][] = (await prominent(path, { amount: 3 })) as number[][];
  const colors = colorsRGB.map((colorRGB) => {
    return {
      rgb: colorRGB,
      hsv: rgbToHSV(colorRGB),
    };
  });

  // Prioritize things that are more colorful over things that are black/white.
  // If everything is black/white, prioritize white.
  const score = (hsv: number[]) => {
    // Use (1 - hsv[2]) if we want to prioritize darker colors instead of lighter ones
    return 0.9 * hsv[1] + 0.1 * hsv[2];
  };

  const bestColor = colors.sort((a, b) => score(b.hsv) - score(a.hsv))[0];
  return `${bestColor.rgb[0]}, ${bestColor.rgb[1]}, ${bestColor.rgb[2]}`;
}

/**
 * Wraps a comma separated list of rgb values into an rgb string.
 * @param color Comma separated list of rgb values
 * @returns rgb string
 */
export function rgb(color: string): string {
  return `rgb(${color})`;
}

/**
 * Wraps a comma separated string of rgb values and an alpha value into an rgba string.
 * @param color Comma separated string of rgb
 * @param alpha Alpha value
 * @returns rgba string
 */
export function rgba(color: string, alpha: number): string {
  return `rgba(${color}, ${alpha})`;
}

/**
 * Gets the brigher of two colors.
 * @param color0 The first color
 * @param color1 The second color
 * @returns The brighter of the two colors
 */
export function getBrighterColor(color0: string, color1: string): string {
  const values0 = color0.split(',').map((v) => parseInt(v.trim()));
  const values1 = color1.split(',').map((v) => parseInt(v.trim()));
  const avg0 = (values0[0] + values0[1] + values0[2]) / 3;
  const avg1 = (values1[0] + values1[1] + values1[2]) / 3;
  return avg0 > avg1 ? color0 : color1;
}
