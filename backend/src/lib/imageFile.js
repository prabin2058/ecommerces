// Validate uploads by their real bytes (not the filename/Content-Type) and strip metadata.
export function detectImageType(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

// Drop APPn (EXIF/XMP/etc.) and COM segments, keep APP0 (JFIF) and image data.
function stripJpeg(buf) {
  const out = [buf.slice(0, 2)];
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return buf; // unexpected layout, keep original
    const marker = buf[i + 1];
    if (marker === 0xda) {
      out.push(buf.slice(i));
      break;
    }
    const len = buf.readUInt16BE(i + 2);
    const isMeta = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!isMeta) out.push(buf.slice(i, i + 2 + len));
    i += 2 + len;
  }
  return Buffer.concat(out);
}

function stripPng(buf) {
  const drop = new Set(["tEXt", "iTXt", "zTXt", "eXIf", "tIME"]);
  const out = [buf.slice(0, 8)];
  let i = 8;
  while (i + 8 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString("ascii", i + 4, i + 8);
    const end = i + 12 + len;
    if (!drop.has(type)) out.push(buf.slice(i, end));
    i = end;
    if (type === "IEND") break;
  }
  return Buffer.concat(out);
}

function stripWebp(buf) {
  // Only simple (lossy/lossless) WebP has no metadata chunks; for VP8X drop EXIF/XMP chunks.
  if (buf.toString("ascii", 12, 16) !== "VP8X") return buf;
  const chunks = [];
  let i = 12;
  while (i + 8 <= buf.length) {
    const type = buf.toString("ascii", i, i + 4);
    const size = buf.readUInt32LE(i + 4);
    const end = i + 8 + size + (size % 2);
    if (type !== "EXIF" && type !== "XMP ") chunks.push(buf.slice(i, end));
    i = end;
  }
  const body = Buffer.concat(chunks);
  // Clear EXIF/XMP flags in VP8X header.
  body[8] &= ~0x0c;
  const header = Buffer.from("RIFF0000WEBP", "ascii");
  header.writeUInt32LE(body.length + 4, 4);
  return Buffer.concat([header, body]);
}

export function stripMetadata(buf, type) {
  try {
    if (type === "jpg") return stripJpeg(buf);
    if (type === "png") return stripPng(buf);
    if (type === "webp") return stripWebp(buf);
  } catch {
    /* fall through */
  }
  return buf;
}
