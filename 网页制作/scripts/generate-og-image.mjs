import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "./paths.mjs";

const width = 1200;
const height = 630;
const output = path.join(projectRoot, "src/assets/og-image.png");
const pixels = Buffer.alloc(width * height * 4);

const palette = {
  paper: [247, 241, 232, 255],
  card: [251, 250, 246, 255],
  ink: [43, 40, 35, 255],
  moss: [95, 117, 97, 255],
  clay: [156, 111, 72, 255],
  muted: [93, 87, 77, 255]
};

const font = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"]
};

function rgbaAt(x, y) {
  return (y * width + x) * 4;
}

function setPixel(x, y, color) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const index = rgbaAt(x, y);
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

function fillRect(x, y, w, h, color) {
  for (let row = Math.max(0, y); row < Math.min(height, y + h); row += 1) {
    for (let col = Math.max(0, x); col < Math.min(width, x + w); col += 1) {
      setPixel(col, row, color);
    }
  }
}

function strokeRect(x, y, w, h, color, size = 2) {
  fillRect(x, y, w, size, color);
  fillRect(x, y + h - size, w, size, color);
  fillRect(x, y, size, h, color);
  fillRect(x + w - size, y, size, h, color);
}

function drawCircle(cx, cy, radius, color) {
  const r2 = radius * radius;
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPixel(x, y, color);
    }
  }
}

function drawLine(x1, y1, x2, y2, color, size = 3) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    const x = Math.round(x1 + (x2 - x1) * t);
    const y = Math.round(y1 + (y2 - y1) * t);
    drawCircle(x, y, Math.max(1, Math.floor(size / 2)), color);
  }
}

function drawWave(yBase, amplitude, color) {
  let previous = null;
  for (let x = 130; x <= 1070; x += 6) {
    const y = Math.round(yBase + Math.sin((x - 130) / 92) * amplitude + Math.sin((x - 130) / 210) * amplitude * 0.55);
    if (previous) drawLine(previous.x, previous.y, x, y, color, 5);
    previous = { x, y };
  }
}

function textWidth(text, scale, gap = 1) {
  return [...text].reduce((total, char) => {
    const glyph = font[char] || font[" "];
    return total + (glyph[0].length + gap) * scale;
  }, 0) - gap * scale;
}

function drawText(text, x, y, scale, color, gap = 1) {
  let cursor = x;
  for (const char of text) {
    const glyph = font[char] || font[" "];
    glyph.forEach((row, rowIndex) => {
      [...row].forEach((cell, colIndex) => {
        if (cell === "1") {
          fillRect(cursor + colIndex * scale, y + rowIndex * scale, scale, scale, color);
        }
      });
    });
    cursor += (glyph[0].length + gap) * scale;
  }
}

function drawCenteredText(text, y, scale, color, gap = 1) {
  const x = Math.round((width - textWidth(text, scale, gap)) / 2);
  drawText(text, x, y, scale, color, gap);
}

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function pngBuffer() {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const sourceStart = y * width * 4;
    const targetStart = y * (width * 4 + 1);
    raw[targetStart] = 0;
    pixels.copy(raw, targetStart + 1, sourceStart, sourceStart + width * 4);
  }

  return Buffer.concat([
    header,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

fillRect(0, 0, width, height, palette.paper);
fillRect(64, 64, 1072, 502, palette.card);
strokeRect(64, 64, 1072, 502, palette.ink, 2);
drawWave(168, 34, palette.clay);
drawWave(540, 18, palette.moss);
drawCircle(174, 141, 10, palette.ink);
drawCircle(1025, 487, 10, palette.ink);
drawCenteredText("SA", 138, 22, palette.ink, 2);
drawCenteredText("SCENT ATOLL", 306, 15, palette.ink, 1);
drawCenteredText("NICHE PERFUME BUYER STORE", 432, 6, palette.muted, 1);
drawCenteredText("SAMPLE FIRST / MANUAL CONSULTATION", 486, 5, palette.moss, 1);

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, pngBuffer());
console.log(`Generated ${path.relative(projectRoot, output)}`);
