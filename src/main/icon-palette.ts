import Vibrant = require('node-vibrant');

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

// extract-file-icon returns PNG bytes. Other formats must never enter Jimp's
// generic sniffer, whose inherited file-type dependency has an ASF parser DoS.
export function getIconPalette(icon: Buffer) {
  if (!isPngIcon(icon)) return Promise.resolve(null);
  return Vibrant.from(icon).getPalette();
}
