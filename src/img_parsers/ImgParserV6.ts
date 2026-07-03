import type { ImgFrame } from './ImgParserTypes';
import { ImgParserBase } from './ImgParserBase';

export class ImgParserV6 extends ImgParserBase {
  public parse(colorBoardIndex: number = 0): ImgFrame[] {
    const entries: ImgFrame[] = [];
    let pos = 32;

    const cbCount = this.view.getUint32(pos, true);
    pos += 4;
    for (let j = 0; j < cbCount; j++) {
      const colorCount = this.view.getUint32(pos, true);
      pos += 4;
      const cb = new Uint8ClampedArray(colorCount * 4);
      for (let i = 0; i < colorCount; i++) {
        cb[i * 4 + 0] = this.view.getUint8(pos + 0);
        cb[i * 4 + 1] = this.view.getUint8(pos + 1);
        cb[i * 4 + 2] = this.view.getUint8(pos + 2);
        cb[i * 4 + 3] = this.view.getUint8(pos + 3);
        pos += 4;
      }
      this.colorBoards.push(cb);
    }

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
          console.warn(`[ImgParserV6] Frame ${i} data exceeds buffer bounds, skipping.`);
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
