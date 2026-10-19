import { PNG } from 'pngjs';
import { MMCQ } from '@vibrant/quantizer-mmcq';
import { DefaultGenerator } from '@vibrant/generator-default';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isPngIcon(icon: Buffer) {
  if (!Buffer.isBuffer(icon) || icon.length < 33 || icon.length > 4 * 1024 * 1024 ||
      !icon.slice(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) ||
      icon.readUInt32BE(8) !== 13 || icon.toString('ascii', 12, 16) !== 'IHDR') {
    return false;
  }
  const width = icon.readUInt32BE(16);
  const height = icon.readUInt32BE(20);
  if (!width || !height || width > 512 || height > 512) return false;
  let offset = 8;
  let imageData = false;
  while (offset + 12 <= icon.length) {
    const length = icon.readUInt32BE(offset);
    if (length > icon.length - offset - 12) return false;
    const type = icon.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT' && length) imageData = true;
    if (type === 'IEND') return imageData && length === 0 && offset + 12 === icon.length;
    offset += length + 12;
  }
  return false;
}

// Legacy Vibrant downsamples to one fifth of each dimension before MMCQ.
// Apply the same separable area average without loading Jimp's generic decoder.
// Transparent pixels do not contribute RGB; alpha itself is area-averaged.
function palettePixels(data: Buffer, width: number, height: number) {
  const targetWidth = Math.max(1, Math.round(width / 5));
  const targetHeight = Math.max(1, Math.round(height / 5));
  const horizontal = new Float32Array(targetWidth * height * 4);
  const output = Buffer.alloc(targetWidth * targetHeight * 4);
  const pass = (source: ArrayLike<number>, sourceWidth: number, sourceHeight: number,
    size: number, vertical: boolean, result: Float32Array | Buffer) => {
    const length = vertical ? sourceHeight : sourceWidth;
    const lines = vertical ? sourceWidth : sourceHeight;
    const ratio = length / size;
    for (let line = 0; line < lines; line++) {
      for (let target = 0; target < size; target++) {
        const start = target * ratio;
        const end = (target + 1) * ratio;
        let r = 0, g = 0, b = 0, alpha = 0, opaque = 0;
        for (let pixel = Math.floor(start); pixel < Math.ceil(end) && pixel < length; pixel++) {
          const weight = Math.min(end, pixel + 1) - Math.max(start, pixel);
          const offset = (vertical ? pixel * sourceWidth + line : line * sourceWidth + pixel) * 4;
          const a = source[offset + 3];
          alpha += a * weight;
          if (a) { opaque += weight; r += source[offset] * weight; g += source[offset + 1] * weight; b += source[offset + 2] * weight; }
        }
        const offset = (vertical ? target * sourceWidth + line : line * size + target) * 4;
        const values = [opaque ? r / opaque : 0, opaque ? g / opaque : 0, opaque ? b / opaque : 0, alpha / ratio];
        for (let channel = 0; channel < 4; channel++) result[offset + channel] = vertical ? Math.round(values[channel]) : values[channel];
      }
    }
  };
  pass(data, width, height, targetWidth, false, horizontal);
  pass(horizontal, targetWidth, height, targetHeight, true, output);
  return output;
}

// Keep the Vibrant MMCQ quantizer and swatch generator, but decode only PNG.
// This avoids Jimp and its generic, vulnerable file-type format sniffing entirely.
export async function getIconPalette(icon: Buffer) {
  if (!isPngIcon(icon)) return null;
  try {
    const image = PNG.sync.read(icon, { checkCRC: true });
    const scaled = palettePixels(image.data, image.width, image.height);
    const pixels: number[] = [];
    for (let i = 0; i < scaled.length; i += 4) {
      const [r, g, b, alpha] = scaled.subarray(i, i + 4);
      // Match Vibrant's default alpha/near-white filter before quantization.
      if (alpha >= 125 && !(r > 250 && g > 250 && b > 250)) pixels.push(r, g, b, alpha);
    }
    if (!pixels.length) return null;
    return await DefaultGenerator(MMCQ(Buffer.from(pixels), { colorCount: 64 }));
  } catch {
    // Corrupt native icons should retain their tab without a computed color.
    return null;
  }
}
