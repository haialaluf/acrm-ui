/**
 * Client-side parsing for the bulk "Import contacts" flow.
 *
 * CSV is parsed by hand; Excel (.xls/.xlsx) goes through SheetJS. Both are
 * reduced to the same string matrix, so the preview / mapping / validation UI
 * works end to end. Any other file type throws `UnsupportedFileError`, which
 * the route surfaces as a notice. (AI-assisted column detection is slated for
 * the upcoming server endpoint; until then we auto-detect by header name.)
 */
import * as XLSX from "xlsx";

export type ParsedFile = {
  filename: string;
  /** Human-readable size, e.g. "12.4 KB". */
  size: string;
  /** Total number of data rows (excludes the header row). */
  rows: number;
  /** Detected column headers. */
  headers: string[];
  /** Every data row, each normalized to `headers.length` cells. */
  allRows: string[][];
};

/** Max rows rendered in the import preview table. */
export const PREVIEW_ROWS = 32;

export class UnsupportedFileError extends Error {}
export class EmptyFileError extends Error {}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * Decode an uploaded text file, honoring its byte-order mark.
 *
 * `File.text()` always decodes as UTF-8, which mangles the UTF-16 exports some
 * tools produce (Meta's Lead Ads download is UTF-16LE) into NUL-interleaved
 * mojibake — every header and cell then fails to match anything.
 */
async function readText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (bytes[0] === 0xff && bytes[1] === 0xfe)
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff)
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));

  // No BOM: UTF-16 text is still recognizable by its NUL padding bytes, which
  // land on odd offsets for LE and even offsets for BE.
  const sample = bytes.subarray(0, 512);
  let evenNuls = 0;
  let oddNuls = 0;
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0x00) i % 2 === 0 ? evenNuls++ : oddNuls++;
  }
  if (oddNuls > sample.length / 4 && evenNuls === 0)
    return new TextDecoder("utf-16le").decode(bytes);
  if (evenNuls > sample.length / 4 && oddNuls === 0)
    return new TextDecoder("utf-16be").decode(bytes);

  return new TextDecoder("utf-8").decode(bytes);
}

/** Delimiters we sniff for, in preference order on a tie. */
const DELIMITERS = [",", "\t", ";", "|"];

/**
 * Guess the field separator from the header line. Files handed out as ".csv"
 * are routinely tab- or semicolon-separated; picking the wrong one collapses
 * every row into a single cell.
 */
function detectDelimiter(text: string): string {
  const header = text.split(/\r?\n/, 1)[0] ?? "";
  let best = ",";
  let bestCount = 0;
  for (const delimiter of DELIMITERS) {
    const count = header.split(delimiter).length - 1;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Parse a CSV string into a matrix of cells, honoring RFC-4180 quoting
 * (double quotes, escaped `""`, embedded delimiters and newlines) and both
 * `\n` and `\r\n` line endings.
 */
function parseCsv(text: string, delimiter = ","): string[][] {
  // Strip UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      // Swallow the \n of a \r\n pair.
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  // Flush the trailing field/row (file without a final newline).
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop fully-empty rows (e.g. a blank trailing line).
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function isCsv(file: File): boolean {
  return (
    file.type === "text/csv" ||
    file.type === "application/csv" ||
    /\.csv$/i.test(file.name)
  );
}

function isExcel(file: File): boolean {
  return (
    /\.xlsx?$/i.test(file.name) ||
    file.type === "application/vnd.ms-excel" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

/** Read the first sheet of an Excel workbook into a string matrix. */
async function parseExcel(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) return [];

  // `header: 1` yields an array-of-arrays; `raw: false` formats every cell to
  // its displayed string (so dates/numbers match what the user sees).
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });

  return matrix
    .map((row) =>
      row.map((cell) =>
        cell == null
          ? ""
          : typeof cell === "object"
            ? JSON.stringify(cell)
            : String(cell as string | number | boolean),
      ),
    )
    .filter((row) => row.some((cell) => cell.trim() !== ""));
}

export async function parseContactsFile(file: File): Promise<ParsedFile> {
  let matrix: string[][];
  if (isCsv(file)) {
    const text = await readText(file);
    matrix = parseCsv(text, detectDelimiter(text));
  } else if (isExcel(file)) {
    matrix = await parseExcel(file);
  } else {
    throw new UnsupportedFileError(file.name);
  }

  if (matrix.length < 2) {
    throw new EmptyFileError(file.name);
  }

  const headers = matrix[0].map((h) => h.trim());
  const width = headers.length;
  const allRows = matrix.slice(1).map((r) => {
    const cells = r.map((c) => c.trim());
    // Pad / trim every row to the header width so the table stays rectangular.
    if (cells.length < width)
      cells.push(...Array(width - cells.length).fill(""));
    return cells.slice(0, width);
  });

  return {
    filename: file.name,
    size: formatBytes(file.size),
    rows: allRows.length,
    headers,
    allRows,
  };
}
