import type { ImgFrame } from './ImgParserTypes';
import { ImgParserBase } from './ImgParserBase';

export class ImgParserV2 extends ImgParserBase {
  public parse(colorBoardIndex: number = 0): ImgFrame[] {
    const entries: ImgFrame[] = [];
    let pos = 32;

    for (let i = 0; i < this.indexCount; i++) {
      const { entry, nextPos } = this.readBasicFrameHeader(pos, i);
      pos = nextPos;
      entries.push(entry);
    }

    for (let i = 0; i < this.indexCount; i++) {
      const entry = entries[i];
      if (entry.type === 'link') {
        this.extractLinkFrame(entry, entries);
        continue;
      }

      if (entry.comp === 0 && entry.size === 0) continue;
      if (entry.w === 0 || entry.h === 0) continue;

      let rawData = new Uint8Array(0);
      if (entry.size! > 0) {
        if (pos + entry.size! > this.buffer.byteLength) {
          console.warn(`[ImgParserV2] Frame ${i} data exceeds buffer bounds, skipping.`);
          continue;
        }
        rawData = new Uint8Array(this.buffer, pos, entry.size!);
        pos += entry.size!;
      }

      let pixelData: Uint8Array;
      if (entry.comp === 6) {
        const decompressed = this.decompress(rawData);
        if (!decompressed) {
          console.error(`Frame ${i} failed to decompress`);
          continue;
        }
        pixelData = decompressed;
      } else {
        pixelData = rawData;
      }

      entry.imageData = this.decodePixelData(entry, rawData, pixelData, this.colorBoards, colorBoardIndex);
    }

    return entries;
  }
}
