// lib/qrcode.js — a from-scratch QR Code encoder (ISO/IEC 18004), zero
// dependencies, so a host's "print my listing's QR" page works with just
// `node server.js` on any machine, the same as the rest of this app.
//
// Scope: byte mode (any UTF-8/URL text), error-correction level M, versions
// 1-20 (up to 669 data bytes — far more than any listing URL needs). That
// covers the one thing this app needs a QR code for.
//
// Output: a square boolean matrix (`true` = dark module) via encode(text).
// Rendering (SVG) lives in views/qr.js, not here.

// ---- GF(256) arithmetic, for Reed-Solomon error correction ----------
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // primitive polynomial x^8+x^4+x^3+x^2+1
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function polyMulGF(p, q) {
  const result = new Array(p.length + q.length - 1).fill(0);
  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < q.length; j++) {
      result[i + j] ^= gfMul(p[i], q[j]);
    }
  }
  return result;
}

function rsGeneratorPoly(degree) {
  let g = [1];
  for (let i = 0; i < degree; i++) g = polyMulGF(g, [1, GF_EXP[i]]);
  return g;
}

// Reed-Solomon encode: returns the EC codewords for one block.
function rsEncode(dataCodewords, ecCount) {
  const generator = rsGeneratorPoly(ecCount);
  const result = dataCodewords.concat(new Array(ecCount).fill(0));
  for (let i = 0; i < dataCodewords.length; i++) {
    const coef = result[i];
    if (coef !== 0) {
      for (let j = 0; j < generator.length; j++) result[i + j] ^= gfMul(generator[j], coef);
    }
  }
  return result.slice(dataCodewords.length);
}

// ---- Standard tables (versions 1-20, error-correction level M) ------
// Total data codewords per version, level M.
const CAPACITY_M = [
  null, 16, 28, 44, 64, 86, 108, 124, 154, 182, 216,
  254, 290, 334, 365, 415, 453, 507, 563, 627, 669,
];

// Block structure per version, level M: [ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data]
const BLOCKS_M = [
  null,
  [10, 1, 16, 0, 0],
  [16, 1, 28, 0, 0],
  [26, 1, 44, 0, 0],
  [18, 2, 32, 0, 0],
  [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0],
  [18, 4, 31, 0, 0],
  [22, 2, 38, 2, 39],
  [22, 3, 36, 2, 37],
  [26, 4, 43, 1, 44],
  [30, 1, 50, 4, 51],
  [22, 6, 36, 2, 37],
  [22, 8, 37, 1, 38],
  [24, 4, 40, 5, 41],
  [24, 5, 41, 5, 42],
  [28, 7, 45, 3, 46],
  [28, 10, 46, 1, 47],
  [26, 9, 43, 4, 44],
  [26, 3, 44, 11, 45],
  [26, 3, 41, 13, 42],
];

// Remainder bits appended after interleaved codewords, per version.
const REMAINDER_BITS = [null, 0, 7, 7, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3];

// Alignment pattern center coordinates (cartesian product, minus the 3
// finder corners), per version. Version 1 has none.
const ALIGNMENT_POSITIONS = [
  null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46],
  [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70],
  [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90],
];

const FORMAT_GENERATOR = 0x537; // degree-10 BCH generator for format info
const FORMAT_MASK = 0x5412;
const VERSION_GENERATOR = 0x1f25; // degree-12 BCH generator for version info (v7+)
const EC_LEVEL_M_BITS = 0b00; // the 2-bit field for level M in the format string (L=01,M=00,Q=11,H=10)

// Standard BCH remainder computation (used for both format and version info).
// generatorBitLen is the generator polynomial's bit width (degree + 1) --
// division continues as long as the working value still has at least that
// many bits, i.e. while shiftedLen >= generatorBitLen (not '>' -- that was
// an off-by-one that stopped one XOR-reduction short and broke every case).
function bchRemainder(value, generator, generatorBitLen) {
  let shifted = value;
  let shiftedLen = 32 - Math.clz32(shifted);
  while (shifted !== 0 && shiftedLen >= generatorBitLen) {
    shifted ^= generator << (shiftedLen - generatorBitLen);
    shiftedLen = 32 - Math.clz32(shifted);
  }
  return shifted;
}

function formatBits(maskPattern) {
  const data = (EC_LEVEL_M_BITS << 3) | maskPattern; // 5 bits
  const value = data << 10;
  const rem = bchRemainder(value, FORMAT_GENERATOR, 11); // 0x537 is 11 bits wide (degree 10)
  const combined = (value | rem) ^ FORMAT_MASK;
  return combined & 0x7fff; // 15 bits
}

function versionBits(version) {
  const value = version << 12;
  const rem = bchRemainder(value, VERSION_GENERATOR, 13); // 0x1F25 is 13 bits wide (degree 12)
  return (value | rem) & 0x3ffff; // 18 bits
}

// ---- Bit stream helpers ----------------------------------------------
function pushBits(bits, value, len) {
  for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1);
}

function bitsToBytes(bits) {
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] || 0);
    bytes.push(byte);
  }
  return bytes;
}

function pickVersion(byteLength) {
  for (let v = 1; v <= 20; v++) {
    const countBits = v <= 9 ? 8 : 16;
    const capacityBits = CAPACITY_M[v] * 8;
    const overheadBits = 4 + countBits;
    const availableBytes = Math.floor((capacityBits - overheadBits) / 8);
    if (availableBytes >= byteLength) return v;
  }
  return null; // message too long for this encoder's supported range
}

function buildDataCodewords(bytes, version) {
  const bits = [];
  pushBits(bits, 0b0100, 4); // byte-mode indicator
  const countBits = version <= 9 ? 8 : 16;
  pushBits(bits, bytes.length, countBits);
  for (const b of bytes) pushBits(bits, b, 8);

  const capacityBits = CAPACITY_M[version] * 8;
  const termLen = Math.max(0, Math.min(4, capacityBits - bits.length));
  pushBits(bits, 0, termLen);
  while (bits.length % 8 !== 0) bits.push(0);

  let padToggle = true;
  while (bits.length < capacityBits) {
    pushBits(bits, padToggle ? 0xec : 0x11, 8);
    padToggle = !padToggle;
  }
  return bitsToBytes(bits);
}

function buildFinalCodewords(dataCodewords, version) {
  const [ecCount, g1Blocks, g1Data, g2Blocks, g2Data] = BLOCKS_M[version];
  const blocks = [];
  let offset = 0;
  for (let i = 0; i < g1Blocks; i++) {
    const data = dataCodewords.slice(offset, offset + g1Data);
    blocks.push({ data, ec: rsEncode(data, ecCount) });
    offset += g1Data;
  }
  for (let i = 0; i < g2Blocks; i++) {
    const data = dataCodewords.slice(offset, offset + g2Data);
    blocks.push({ data, ec: rsEncode(data, ecCount) });
    offset += g2Data;
  }

  const maxDataLen = Math.max(...blocks.map((b) => b.data.length));
  const out = [];
  for (let i = 0; i < maxDataLen; i++) {
    for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
  }
  for (let i = 0; i < ecCount; i++) {
    for (const b of blocks) out.push(b.ec[i]);
  }
  return out;
}

// ---- Module matrix construction --------------------------------------
function makeMatrix(version) {
  const size = 17 + 4 * version;
  const modules = Array.from({ length: size }, () => new Array(size).fill(null));
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));

  function set(r, c, dark) {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    modules[r][c] = dark;
    isFunction[r][c] = true;
  }

  function drawFinder(r0, c0) {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const isBorder = dr === -1 || dr === 7 || dc === -1 || dc === 7;
        const isOuterRing = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && (dr === 0 || dr === 6 || dc === 0 || dc === 6);
        const isCenter = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        const dark = !isBorder && (isOuterRing || isCenter);
        set(r, c, isBorder ? false : dark);
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // timing patterns
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // alignment patterns
  const positions = ALIGNMENT_POSITIONS[version];
  for (const r of positions) {
    for (const c of positions) {
      // skip the three positions that collide with finder patterns
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const ring = Math.max(Math.abs(dr), Math.abs(dc));
          set(r + dr, c + dc, ring !== 1);
        }
      }
    }
  }

  // dark module
  set(4 * version + 9, 8, true);

  // reserve format info areas (value written later, after masking)
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) { set(8, i, false); set(i, 8, false); }
  }
  // Copy B of the format info splits 8 bits along the top-right row and 7
  // bits along the bottom-left column (15 bits total) -- NOT 8+8. Getting
  // this wrong over-reserves one cell in the column, which always lands
  // exactly on the dark module's row (size-8 === 4*version+9 for every
  // version) and silently clobbers it.
  for (let i = 0; i < 8; i++) set(8, size - 1 - i, false);
  for (let i = 0; i < 7; i++) set(size - 7 + i, 8, false);

  // reserve version info areas (v7+)
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const r = Math.floor(i / 3);
      const c = i % 3;
      set(r, size - 11 + c, false);
      set(size - 11 + c, r, false);
    }
  }

  return { size, modules, isFunction };
}

function placeData(matrix, codewords) {
  const { size, modules, isFunction } = matrix;
  const bits = [];
  for (const byte of codewords) for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  let bitIndex = 0;

  let col = size - 1;
  let upward = true;
  while (col > 0) {
    if (col === 6) col--; // skip timing column
    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (!isFunction[row][c]) {
          const bit = bitIndex < bits.length ? bits[bitIndex] : 0;
          modules[row][c] = bit === 1;
          bitIndex++;
        }
      }
    }
    upward = !upward;
    col -= 2;
  }
}

function applyMaskAndScore(matrix, maskFn) {
  const { size, modules, isFunction } = matrix;
  const masked = modules.map((row, r) => row.map((v, c) => (isFunction[r][c] ? v : v !== maskFn(r, c))));
  return { masked, penalty: penaltyScore(masked, size) };
}

const MASK_FNS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function penaltyScore(m, size) {
  let penalty = 0;

  // Rule 1: runs of 5+ same-color modules, per row and per column.
  function runPenalty(getVal) {
    let p = 0;
    for (let i = 0; i < size; i++) {
      let runLen = 1;
      let prev = getVal(i, 0);
      for (let j = 1; j < size; j++) {
        const v = getVal(i, j);
        if (v === prev) {
          runLen++;
        } else {
          if (runLen >= 5) p += 3 + (runLen - 5);
          runLen = 1;
          prev = v;
        }
      }
      if (runLen >= 5) p += 3 + (runLen - 5);
    }
    return p;
  }
  penalty += runPenalty((i, j) => m[i][j]);
  penalty += runPenalty((i, j) => m[j][i]);

  // Rule 2: 2x2 blocks of the same color.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) penalty += 3;
    }
  }

  // Rule 3: 1:1:3:1:1 finder-like patterns, with 4 light modules of padding.
  const pattern = [true, false, true, true, true, false, true];
  function hasPattern(getVal, i, len) {
    for (let start = 0; start <= len - 11; start++) {
      let matchCore = true;
      for (let k = 0; k < 7; k++) if (getVal(i, start + k) !== pattern[k]) { matchCore = false; break; }
      if (!matchCore) continue;
      const before4 = [0, 1, 2, 3].every((k) => start - 1 - k >= 0 && getVal(i, start - 1 - k) === false);
      const after4 = [0, 1, 2, 3].every((k) => start + 7 + k < len && getVal(i, start + 7 + k) === false);
      if (before4 || after4) penalty += 40;
    }
  }
  for (let i = 0; i < size; i++) {
    hasPattern((row, j) => m[row][j], i, size);
    hasPattern((col, j) => m[j][col], i, size);
  }

  // Rule 4: proportion of dark modules vs. 50%.
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (m[r][c]) dark++;
  const percent = (dark / (size * size)) * 100;
  const deviation = Math.floor(Math.abs(percent - 50) / 5);
  penalty += deviation * 10;

  return penalty;
}

function writeFormatAndVersion(modules, size, version, maskPattern) {
  const fmt = formatBits(maskPattern);
  const bit = (i) => ((fmt >> i) & 1) === 1;
  // copy A: around top-left finder. Positions in this exact traversal order
  // hold bits b0 (LSB) through b14 (MSB), ascending -- verified empirically
  // against real reference QR matrices (libqrencode), not from memory.
  const copyA = [
    [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8],
    [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = copyA[i];
    modules[r][c] = bit(i);
  }
  // copy B: row 8, columns size-8..size-1 (ascending) holds bits b7 downto
  // b0; column 8, rows size-7..size-1 (ascending) holds bits b8 up to b14.
  // Also verified empirically against real reference matrices.
  for (let i = 0; i < 8; i++) modules[8][size - 8 + i] = bit(7 - i);
  for (let i = 0; i < 7; i++) modules[size - 7 + i][8] = bit(8 + i);

  if (version >= 7) {
    const v = versionBits(version);
    const vbit = (i) => ((v >> i) & 1) === 1;
    for (let i = 0; i < 18; i++) {
      const r = Math.floor(i / 3);
      const c = i % 3;
      modules[r][size - 11 + c] = vbit(i);
      modules[size - 11 + c][r] = vbit(i);
    }
  }
}

// Encode `text` (a UTF-8 string) into a QR code matrix.
// Returns { size, modules } where modules[r][c] is true for a dark module.
export function encodeQR(text) {
  const bytes = Array.from(Buffer.from(text, 'utf8'));
  const version = pickVersion(bytes.length);
  if (!version) throw new Error('Text too long for this QR encoder (max ~660 bytes).');

  const dataCodewords = buildDataCodewords(bytes, version);
  const finalCodewords = buildFinalCodewords(dataCodewords, version);

  const matrix = makeMatrix(version);
  placeData(matrix, finalCodewords);

  let best = null;
  for (let m = 0; m < 8; m++) {
    const { masked, penalty } = applyMaskAndScore(matrix, MASK_FNS[m]);
    if (!best || penalty < best.penalty) best = { masked, penalty, mask: m };
  }

  writeFormatAndVersion(best.masked, matrix.size, version, best.mask);

  return { size: matrix.size, modules: best.masked };
}
