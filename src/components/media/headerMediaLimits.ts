import { type HeaderMediaFormat } from "@/components/templateFill/types";

// Meta approves a template whose sample is over WhatsApp's send limit, then
// fails every send with 131053. Document is our own cap; Meta allows 100 MB.
export const HEADER_MEDIA_MAX_MB: Record<HeaderMediaFormat, number> = {
  IMAGE: 5,
  VIDEO: 16,
  DOCUMENT: 10,
};

export function headerMediaTooLarge(
  format: HeaderMediaFormat,
  bytes: number,
): boolean {
  return bytes > HEADER_MEDIA_MAX_MB[format] * 1000 * 1000;
}

export function toMB(bytes: number): string {
  return (bytes / (1000 * 1000)).toFixed(1);
}

export class HeaderMediaTooLargeError extends Error {
  readonly bytes: number;
  readonly maxMB: number;

  constructor(bytes: number, maxMB: number) {
    super(`Header media is ${toMB(bytes)} MB, limit is ${maxMB} MB`);
    this.bytes = bytes;
    this.maxMB = maxMB;
  }
}
