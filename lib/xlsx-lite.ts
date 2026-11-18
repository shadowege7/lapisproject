/**
 * Just enough of an .xlsx reader to pull the first worksheet out as a grid of
 * cells — no dependency, so nothing new ships to the browser beyond this file.
 *
 * An .xlsx is a zip of XML parts. This reads the zip's central directory,
 * inflates the parts it needs with the platform's DecompressionStream
 * (browsers and Node 18+), and walks the sheet XML with regular expressions.
 * That is fine for the flat, machine-written exports this is for (a DMS deal
 * export); it is not a general spreadsheet engine — no formulas are evaluated
 * (the cached value is read), and styles are ignored.
 *
 * Cells come back as string | number | boolean | null. Dates stored as real
 * Excel dates arrive as serial numbers; see excelSerialToISO in deal-import.
 */

export type Cell = string | number | boolean | null;

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
}

function readZipDirectory(buf: Uint8Array): Map<string, ZipEntry> {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // End of central directory: signature 0x06054b50, scanning back over the
  // trailing comment (at most 64KB).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not an .xlsx file (no zip directory found).");

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const entries = new Map<string, ZipEntry>();
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = decoder.decode(buf.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, { name, method, compressedSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readEntry(
  buf: Uint8Array,
  entries: Map<string, ZipEntry>,
  name: string,
): Promise<string | null> {
  const e = entries.get(name);
  if (!e) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const lh = e.localOffset;
  if (view.getUint32(lh, true) !== 0x04034b50) return null;
  const nameLen = view.getUint16(lh + 26, true);
  const extraLen = view.getUint16(lh + 28, true);
  const start = lh + 30 + nameLen + extraLen;
  const raw = buf.subarray(start, start + e.compressedSize);
  const bytes =
    e.method === 0 ? raw : e.method === 8 ? await inflateRaw(raw) : null;
  if (!bytes) throw new Error("This .xlsx uses a compression method that isn't supported.");
  return new TextDecoder().decode(bytes);
}

function decodeXml(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** All <t> runs inside a fragment, joined — covers plain and rich text. */
function textRuns(fragment: string): string {
  let out = "";
  for (const m of fragment.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) {
    out += m[1];
  }
  return decodeXml(out);
}

/** "AB12" → zero-based column 27. */
function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Resolve the first sheet in workbook order, falling back to sheet1.xml. */
async function firstSheetPath(
  buf: Uint8Array,
  entries: Map<string, ZipEntry>,
): Promise<string> {
  const fallback = "xl/worksheets/sheet1.xml";
  const workbook = await readEntry(buf, entries, "xl/workbook.xml");
  const rels = await readEntry(buf, entries, "xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) return fallback;
  const sheet = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook);
  if (!sheet) return fallback;
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const attrs = m[1];
    if (new RegExp(`\\bId="${sheet[1]}"`).test(attrs)) {
      const target = /\bTarget="([^"]+)"/.exec(attrs)?.[1];
      if (!target) break;
      const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
      return entries.has(path) ? path : fallback;
    }
  }
  return fallback;
}

/** The first worksheet of an .xlsx as rows of cells (ragged; blanks are null). */
export async function readFirstSheet(data: ArrayBuffer): Promise<Cell[][]> {
  const buf = new Uint8Array(data);
  const entries = readZipDirectory(buf);

  const shared: string[] = [];
  const sst = await readEntry(buf, entries, "xl/sharedStrings.xml");
  if (sst) {
    for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(textRuns(m[1]));
  }

  const sheetXml = await readEntry(buf, entries, await firstSheetPath(buf, entries));
  if (!sheetXml) throw new Error("Couldn't find a worksheet in that file.");

  const rows: Cell[][] = [];
  for (const rm of sheetXml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rowNum = Number(/\br="(\d+)"/.exec(rm[1])?.[1] ?? rows.length + 1);
    const row: Cell[] = [];
    const body = rm[2] ?? "";
    let nextCol = 0;
    for (const cm of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const inner = cm[2] ?? "";
      const ref = /\br="([A-Z]+\d+)"/i.exec(attrs)?.[1];
      const col = ref ? columnIndex(ref) : nextCol;
      nextCol = col + 1;
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let value: Cell = null;
      if (type === "s") value = v !== undefined ? (shared[Number(v)] ?? "") : null;
      else if (type === "inlineStr") value = textRuns(inner);
      else if (type === "str" || type === "e") value = v !== undefined ? decodeXml(v) : null;
      else if (type === "b") value = v === "1";
      else if (v !== undefined && v !== "") {
        const n = Number(v);
        value = Number.isFinite(n) ? n : decodeXml(v);
      }
      row[col] = value;
    }
    for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = null;
    rows[rowNum - 1] = row;
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}
