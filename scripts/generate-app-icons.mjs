import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const MASTER_SIZE = 1024;
const ICO_SIZES = [16, 32, 48, 256];
const MAC_ICONSET_ENTRIES = [
  { file: 'icon_16x16.png', size: 16 },
  { file: 'icon_16x16@2x.png', size: 32 },
  { file: 'icon_32x32.png', size: 32 },
  { file: 'icon_32x32@2x.png', size: 64 },
  { file: 'icon_128x128.png', size: 128 },
  { file: 'icon_128x128@2x.png', size: 256 },
  { file: 'icon_256x256.png', size: 256 },
  { file: 'icon_256x256@2x.png', size: 512 },
  { file: 'icon_512x512.png', size: 512 },
  { file: 'icon_512x512@2x.png', size: 1024 }
];

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function blendOver(dstR, dstG, dstB, dstA, srcR, srcG, srcB, srcA) {
  const sa = clamp01(srcA);
  if (sa <= 0) return [dstR, dstG, dstB, dstA];
  const da = clamp01(dstA);
  const outA = sa + da * (1 - sa);
  if (outA <= 1e-6) return [0, 0, 0, 0];
  const outR = (srcR * sa + dstR * da * (1 - sa)) / outA;
  const outG = (srcG * sa + dstG * da * (1 - sa)) / outA;
  const outB = (srcB * sa + dstB * da * (1 - sa)) / outA;
  return [outR, outG, outB, outA];
}

function sdRoundedBox(px, py, halfW, halfH, radius) {
  const qx = Math.abs(px) - (halfW - radius);
  const qy = Math.abs(py) - (halfH - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - radius;
}

function sdCapsuleVertical(px, py, cx, halfHeight, radius) {
  const dx = px - cx;
  const dy = Math.abs(py) - halfHeight;
  return Math.hypot(dx, Math.max(dy, 0)) + Math.min(dy, 0) - radius;
}

/**
 * Renders the 1024x1024 dark-studio `aie` vocal-waveform + pitch-track icon.
 */
function renderMasterIcon(size) {
  const rgba = new Uint8Array(size * size * 4);
  const half = size * 0.5;
  const tileHalf = size * 0.435;
  const tileRadius = size * 0.215;

  // Symmetric vocal waveform bars across [-0.30, +0.30] of icon width
  const bars = [
    { x: -0.27, h: 0.075 },
    { x: -0.2025, h: 0.145 },
    { x: -0.135, h: 0.235 },
    { x: -0.0675, h: 0.175 },
    { x: 0.0, h: 0.285 },
    { x: 0.0675, h: 0.205 },
    { x: 0.135, h: 0.255 },
    { x: 0.2025, h: 0.135 },
    { x: 0.27, h: 0.07 }
  ];
  const barRadius = size * 0.021;

  for (let y = 0; y < size; y++) {
    const py = y + 0.5 - half;
    const ny = py / size;

    for (let x = 0; x < size; x++) {
      const px = x + 0.5 - half;
      const nx = px / size;

      const tileDist = sdRoundedBox(px, py, tileHalf, tileHalf, tileRadius);
      const tileAlpha = 1 - smoothstep(-1.2, 1.2, tileDist);

      if (tileAlpha <= 0) {
        continue;
      }

      // 1. Dark vocal-booth studio base (#0b0d12 -> #151b2e with subtle radial glow)
      const vGrad = clamp01((ny + 0.44) / 0.88);
      const centerGlow = Math.exp(-(nx * nx * 8.5 + (ny + 0.04) * (ny + 0.04) * 9.5));
      let r = lerp(18, 10, vGrad) + centerGlow * 22;
      let g = lerp(23, 12, vGrad) + centerGlow * 28;
      let b = lerp(38, 19, vGrad) + centerGlow * 58;
      let a = 1;

      // Subtle chromatic target pitch reference line across the booth center
      const targetLineDist = Math.abs(py) - size * 0.003;
      if (Math.abs(nx) < 0.35 && targetLineDist < 2) {
        const lineMask = (1 - smoothstep(-1, 1.2, targetLineDist)) * (1 - smoothstep(0.28, 0.35, Math.abs(nx)));
        [r, g, b, a] = blendOver(r, g, b, a, 99, 102, 241, 0.28 * lineMask);
      }

      // 2. Crisp inner rim highlight on the squircle border
      const rimBand = 1 - smoothstep(0, size * 0.012, Math.abs(tileDist + size * 0.008));
      if (rimBand > 0) {
        const topBias = clamp01(0.65 - ny * 1.1);
        [r, g, b, a] = blendOver(r, g, b, a, 129, 140, 248, rimBand * (0.18 + 0.28 * topBias));
      }

      // 3. Vocal waveform bars (indigo -> cyan -> emerald peak gradient)
      let minBarDist = 1e9;
      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];
        const d = sdCapsuleVertical(px, py, bar.x * size, bar.h * size, barRadius);
        if (d < minBarDist) minBarDist = d;
      }

      // Soft ambient glow behind waveform bars
      const barGlow = Math.exp(-Math.max(minBarDist, 0) / (size * 0.038));
      if (barGlow > 0.01) {
        const colorMix = clamp01((nx + 0.3) / 0.6);
        const gr = lerp(99, 34, colorMix);
        const gg = lerp(102, 211, colorMix);
        const gb = lerp(241, 238, colorMix);
        [r, g, b, a] = blendOver(r, g, b, a, gr, gg, gb, barGlow * 0.24);
      }

      const barMask = 1 - smoothstep(-1.1, 1.1, minBarDist);
      if (barMask > 0) {
        const tX = clamp01((nx + 0.28) / 0.56);
        const peakFocus = 1 - clamp01(Math.abs(nx) / 0.22);
        // Indigo (#818cf8) -> Cyan (#38bdf8) -> Emerald-Mint (#34d399) at locked center pitch
        let br = lerp(129, 56, tX);
        let bg = lerp(140, 215, tX);
        let bb = lerp(248, 248, tX);
        br = lerp(br, 110, peakFocus * 0.35);
        bg = lerp(bg, 242, peakFocus * 0.45);
        bb = lerp(bb, 215, peakFocus * 0.25);
        // Bright specular crest near bar center
        const crest = Math.exp(-(ny * ny) * 18) * 28;
        [r, g, b, a] = blendOver(
          r,
          g,
          b,
          a,
          Math.min(255, br + crest),
          Math.min(255, bg + crest),
          Math.min(255, bb + crest),
          barMask
        );
      }

      // 4. Live f0 pitch contour curve sweeping smoothly across the waveform
      if (Math.abs(nx) <= 0.33) {
        const u = nx / 0.33; // [-1, 1]
        const curveY = -Math.sin(u * Math.PI * 0.85) * 0.115 * size - 0.02 * size;
        const slope = (-Math.cos(u * Math.PI * 0.85) * (Math.PI * 0.85) * 0.115) / 0.33;
        const perpDist = Math.abs(py - curveY) / Math.hypot(1, slope);
        const endFade = 1 - smoothstep(0.84, 1.0, Math.abs(u));
        const curveRadius = size * 0.0135;
        const curveMask = (1 - smoothstep(curveRadius - 1.1, curveRadius + 1.1, perpDist)) * endFade;
        if (curveMask > 0) {
          [r, g, b, a] = blendOver(r, g, b, a, 190, 242, 100, curveMask * 0.95);
        }
      }

      // 5. Studio Record indicator dot in top-right corner of the booth frame
      const recDist = Math.hypot(px - size * 0.265, py + size * 0.265) - size * 0.043;
      const recGlow = Math.exp(-Math.max(recDist, 0) / (size * 0.028));
      if (recGlow > 0.01) {
        [r, g, b, a] = blendOver(r, g, b, a, 244, 63, 94, recGlow * 0.38);
      }
      const recMask = 1 - smoothstep(-1.1, 1.1, recDist);
      if (recMask > 0) {
        [r, g, b, a] = blendOver(r, g, b, a, 251, 113, 133, recMask);
      }

      const outIdx = (y * size + x) * 4;
      const finalAlpha = clamp01(a * tileAlpha);
      rgba[outIdx] = Math.round(clamp01(r / 255) * 255);
      rgba[outIdx + 1] = Math.round(clamp01(g / 255) * 255);
      rgba[outIdx + 2] = Math.round(clamp01(b / 255) * 255);
      rgba[outIdx + 3] = Math.round(finalAlpha * 255);
    }
  }

  return rgba;
}

/**
 * Premultiplied box-filter downsampler so small sizes (16x16, 32x32, 48x48) stay crisp.
 */
function downsampleRgba(src, srcSize, dstSize) {
  if (srcSize === dstSize) return new Uint8Array(src);
  const scale = srcSize / dstSize;
  const dst = new Uint8Array(dstSize * dstSize * 4);

  for (let dy = 0; dy < dstSize; dy++) {
    const sy0 = Math.floor(dy * scale);
    const sy1 = Math.min(srcSize, Math.ceil((dy + 1) * scale));
    for (let dx = 0; dx < dstSize; dx++) {
      const sx0 = Math.floor(dx * scale);
      const sx1 = Math.min(srcSize, Math.ceil((dx + 1) * scale));

      let sumPR = 0;
      let sumPG = 0;
      let sumPB = 0;
      let sumA = 0;
      let count = 0;

      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const idx = (sy * srcSize + sx) * 4;
          const a = src[idx + 3] / 255;
          sumPR += src[idx] * a;
          sumPG += src[idx + 1] * a;
          sumPB += src[idx + 2] * a;
          sumA += a;
          count++;
        }
      }

      const outIdx = (dy * dstSize + dx) * 4;
      if (sumA > 1e-6 && count > 0) {
        dst[outIdx] = Math.round(sumPR / sumA);
        dst[outIdx + 1] = Math.round(sumPG / sumA);
        dst[outIdx + 2] = Math.round(sumPB / sumA);
        dst[outIdx + 3] = Math.round((sumA / count) * 255);
      }
    }
  }

  return dst;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePngRgba(rgba, width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter: None
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, rowStart + 1);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressed),
    makePngChunk('IEND', Buffer.alloc(0))
  ]);
}

function encodeMultiSizeIco(entries) {
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(count, 4);

  const dirSize = 16 * count;
  const dir = Buffer.alloc(dirSize);
  let dataOffset = 6 + dirSize;

  entries.forEach((entry, index) => {
    const base = index * 16;
    dir[base] = entry.size >= 256 ? 0 : entry.size;
    dir[base + 1] = entry.size >= 256 ? 0 : entry.size;
    dir[base + 2] = 0; // palette count
    dir[base + 3] = 0; // reserved
    dir.writeUInt16LE(1, base + 4); // color planes
    dir.writeUInt16LE(32, base + 6); // bits per pixel
    dir.writeUInt32LE(entry.png.length, base + 8);
    dir.writeUInt32LE(dataOffset, base + 12);
    dataOffset += entry.png.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

const buildDir = path.resolve('build');
fs.mkdirSync(buildDir, { recursive: true });

const masterRgba = renderMasterIcon(MASTER_SIZE);
const masterPng = encodePngRgba(masterRgba, MASTER_SIZE, MASTER_SIZE);
const iconPngPath = path.join(buildDir, 'icon.png');
fs.writeFileSync(iconPngPath, masterPng);

// Generate multi-size Windows .ico (16, 32, 48, 256 PNG-in-ICO)
const icoEntries = ICO_SIZES.map((size) => ({
  size,
  png: encodePngRgba(downsampleRgba(masterRgba, MASTER_SIZE, size), size, size)
}));
const iconIcoPath = path.join(buildDir, 'icon.ico');
fs.writeFileSync(iconIcoPath, encodeMultiSizeIco(icoEntries));

// Generate macOS Retina .icns via iconutil when running on macOS
if (process.platform === 'darwin') {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aie-iconset-'));
  const iconsetDir = path.join(tmpRoot, 'icon.iconset');
  fs.mkdirSync(iconsetDir, { recursive: true });
  try {
    const cachedPngBySize = new Map([[MASTER_SIZE, masterPng]]);
    for (const item of MAC_ICONSET_ENTRIES) {
      let png = cachedPngBySize.get(item.size);
      if (!png) {
        png = encodePngRgba(downsampleRgba(masterRgba, MASTER_SIZE, item.size), item.size, item.size);
        cachedPngBySize.set(item.size, png);
      }
      fs.writeFileSync(path.join(iconsetDir, item.file), png);
    }
    execFileSync('/usr/bin/iconutil', ['-c', 'icns', iconsetDir, '-o', path.join(buildDir, 'icon.icns')]);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

console.log(
  `[generate-app-icons] Generated build/icon.png (${MASTER_SIZE}x${MASTER_SIZE}), build/icon.ico (${ICO_SIZES.join(',')}), and build/icon.icns.`
);
