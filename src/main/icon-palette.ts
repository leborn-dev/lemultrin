import { inflateSync } from 'zlib';
import { MMCQ } from '@vibrant/quantizer-mmcq';
import { DefaultGenerator } from '@vibrant/generator-default';

// pngjs 7.0.0 private decoding stages, composed without its unbounded Adam7
// parser-sync inflate branch. Keep this integration pinned and regression tested.
const PngParser = require('pngjs/lib/parser');
const SyncReader = require('pngjs/lib/sync-reader');
const FilterSync = require('pngjs/lib/filter-parse-sync');
const bitmapper = require('pngjs/lib/bitmapper');
const normalise = require('pngjs/lib/format-normaliser');

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

interface PngMetadata {
  width: number;
  height: number;
  depth: number;
  colorType: number;
  interlace: boolean;
  bpp: number;
  alpha: boolean;
  palette?: boolean | number[][];
  transColor?: number[];
}

// W3C PNG Adam7 pass origins and strides. Each non-empty reduced image has
// independently padded scanlines, with one filter byte per scanline.
const ADAM7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8],
  [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];

function scanlineBudget(meta: PngMetadata) {
  const { width, height, depth, colorType } = meta;
  const formats: Record<number, { channels: number; depths: number[] }> = {
    0: { channels: 1, depths: [1, 2, 4, 8, 16] },
    2: { channels: 3, depths: [8, 16] },
    3: { channels: 1, depths: [1, 2, 4, 8] },
    4: { channels: 2, depths: [8, 16] },
    6: { channels: 4, depths: [8, 16] },
  };
  const format = formats[colorType];
  if (!width || !height || width > 512 || height > 512 || !format || !format.depths.includes(depth)) {
    throw new Error('Unsupported icon PNG geometry or sample format');
  }
  let bytes = 0;
  for (const [x, y, dx, dy] of meta.interlace ? ADAM7 : [[0, 0, 1, 1]]) {
    if (width <= x || height <= y) continue;
    const passWidth = Math.ceil((width - x) / dx);
    const passHeight = Math.ceil((height - y) / dy);
    bytes += passHeight * (1 + Math.ceil(passWidth * format.channels * depth / 8));
  }
  return bytes;
}

function readBoundedPng(icon: Buffer) {
  let metadata: PngMetadata;
  let budget = 0;
  const compressed: Buffer[] = [];
  const reader = new SyncReader(icon);
  const parser = new PngParser({ checkCRC: true }, {
    read: reader.read.bind(reader),
    error: (error: Error) => { throw error; },
    metadata: (value: PngMetadata) => {
      if (metadata) throw new Error('Duplicate PNG IHDR');
      budget = scanlineBudget(value);
      metadata = value;
    },
    palette: (value: number[][]) => { metadata.palette = value; },
    transColor: (value: number[]) => { metadata.transColor = value; },
    simpleTransparency: () => { metadata.alpha = true; },
    gamma: () => {},
    inflateData: (value: Buffer) => { compressed.push(value); },
  });
  parser.start();
  reader.process();
  if (!metadata || !budget) throw new Error('Missing PNG header');
  // Applies to ordinary and Adam7 data alike, before output allocation can
  // exceed the exact geometry budget. Short streams are malformed as well.
  const raw = inflateSync(Buffer.concat(compressed), { maxOutputLength: budget });
  if (raw.length !== budget) throw new Error('PNG scanline byte count mismatch');
  const unfiltered = FilterSync.process(raw, metadata);
  const bitmap = bitmapper.dataToBitMap(unfiltered, metadata);
  return { ...metadata, data: normalise(bitmap, metadata, false) as Buffer };
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
    // Snapshot potentially shared/mutable input before validation and decode.
    const image = readBoundedPng(Buffer.from(icon));
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
