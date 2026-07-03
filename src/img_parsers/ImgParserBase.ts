import pako from 'pako';
import type { ImgFrame, ImgSprite } from './ImgParserTypes';

export abstract class ImgParserBase {
  protected buffer: ArrayBuffer;
  protected view: DataView;
  
  protected indexSize: number;
  protected reserved: number;
  protected version: number;
  protected indexCount: number;

  public sprites: ImgSprite[] = [];
  public colorBoards: Uint8ClampedArray[] = [];

  constructor(buffer: ArrayBuffer, indexSize: number, reserved: number, version: number, indexCount: number) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.indexSize = indexSize;
    this.reserved = reserved;
    this.version = version;
    this.indexCount = indexCount;
  }

  public abstract parse(colorBoardIndex?: number): ImgFrame[];

  protected decodePixelData(
    entry: ImgFrame,
    _rawData: Uint8Array,
    pixelData: Uint8Array,
    colorBoards: Uint8ClampedArray[],
    colorBoardIndex: number = 0
  ): ImageData | undefined {
    entry.rawPixelData = pixelData;
    
    const w = entry.w;
    const h = entry.h;
    const rgba = new Uint8ClampedArray(w * h * 4);

    if (entry.comp === 6 && colorBoards.length > 0 && pixelData.length === w * h) {
      const cb = colorBoards[colorBoardIndex] || colorBoards[0];
      for (let j = 0; j < w * h; j++) {
        const index = pixelData[j];
        rgba[j * 4 + 0] = cb[index * 4 + 0];
        rgba[j * 4 + 1] = cb[index * 4 + 1];
        rgba[j * 4 + 2] = cb[index * 4 + 2];
        rgba[j * 4 + 3] = cb[index * 4 + 3];
      }
      return new ImageData(rgba, w, h);
    }

    if (entry.color === 16) {
      for (let j = 0; j < w * h; j++) {
        rgba[j * 4 + 0] = pixelData[j * 4 + 2];
        rgba[j * 4 + 1] = pixelData[j * 4 + 1];
        rgba[j * 4 + 2] = pixelData[j * 4 + 0];
        rgba[j * 4 + 3] = pixelData[j * 4 + 3];
      }
    } else if (entry.color === 15) {
      const dataView = new DataView(pixelData.buffer, pixelData.byteOffset, pixelData.byteLength);
      for (let j = 0; j < w * h; j++) {
        const p = dataView.getUint16(j * 2, true);
        const a = (p >> 12) & 0xF;
        const r = (p >> 8) & 0xF;
        const g = (p >> 4) & 0xF;
        const b = p & 0xF;
        rgba[j * 4 + 0] = (r << 4) | r;
        rgba[j * 4 + 1] = (g << 4) | g;
        rgba[j * 4 + 2] = (b << 4) | b;
        rgba[j * 4 + 3] = (a << 4) | a;
      }
    } else if (entry.color === 14) {
      const dataView = new DataView(pixelData.buffer, pixelData.byteOffset, pixelData.byteLength);
      for (let j = 0; j < w * h; j++) {
        const p = dataView.getUint16(j * 2, true);
        const a = (p & 0x8000) ? 255 : 0;
        const r = (p >> 10) & 0x1F;
        const g = (p >> 5) & 0x1F;
        const b = p & 0x1F;
        rgba[j * 4 + 0] = (r << 3) | (r >> 2);
        rgba[j * 4 + 1] = (g << 3) | (g >> 2);
        rgba[j * 4 + 2] = (b << 3) | (b >> 2);
        rgba[j * 4 + 3] = a;
      }
    }

    return new ImageData(rgba, w, h);
  }

  protected decompress(rawData: Uint8Array): Uint8Array | null {
    try {
      return pako.inflate(rawData);
    } catch (e) {
      console.error('Decompression error:', e);
      return null;
    }
  }

  protected readColorBoard(pos: number): { cb: Uint8ClampedArray, nextPos: number } {
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
    return { cb, nextPos: pos };
  }

  protected extractLinkFrame(entry: ImgFrame, entries: ImgFrame[]) {
    const targetEntry = entries[entry.target!];
    if (targetEntry && targetEntry.type === 'image') {
      entry.w = targetEntry.w;
      entry.h = targetEntry.h;
      entry.x = targetEntry.x;
      entry.y = targetEntry.y;
      entry.fw = targetEntry.fw;
      entry.fh = targetEntry.fh;
      entry.imageData = targetEntry.imageData;
      entry.rawPixelData = targetEntry.rawPixelData;
    }
  }

  protected readBasicFrameHeader(pos: number, frameIndex: number): { entry: ImgFrame, nextPos: number } {
    const typeVal = this.view.getUint32(pos, true);
    pos += 4;

    if (typeVal === 0x11) {
      const targetFrame = this.view.getUint32(pos, true);
      pos += 4;
      return {
        entry: {
          frameIndex,
          type: 'link',
          target: targetFrame,
          w: 0, h: 0, x: 0, y: 0, fw: 0, fh: 0,
          rawDataOffset: -1
        },
        nextPos: pos
      };
    }

    const colorSys = typeVal;
    const compState = this.view.getUint32(pos, true); pos += 4;
    const width = this.view.getUint32(pos, true); pos += 4;
    const height = this.view.getUint32(pos, true); pos += 4;
    const size = this.view.getUint32(pos, true); pos += 4;
    const x = this.view.getInt32(pos, true); pos += 4;
    const y = this.view.getInt32(pos, true); pos += 4;
    const frameW = this.view.getUint32(pos, true); pos += 4;
    const frameH = this.view.getUint32(pos, true); pos += 4;

    return {
      entry: {
        frameIndex,
        type: 'image',
        color: colorSys,
        comp: compState,
        w: width,
        h: height,
        size: size,
        x: x,
        y: y,
        fw: frameW,
        fh: frameH,
        rawDataOffset: -1
      },
      nextPos: pos
    };
  }
}
