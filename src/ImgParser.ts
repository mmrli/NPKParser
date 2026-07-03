import type { ImgFrame, ImgSprite } from './img_parsers/ImgParserTypes';
import { ImgParserV1 } from './img_parsers/ImgParserV1';
import { ImgParserV2 } from './img_parsers/ImgParserV2';
import { ImgParserV4 } from './img_parsers/ImgParserV4';
import { ImgParserV5 } from './img_parsers/ImgParserV5';
import { ImgParserV6 } from './img_parsers/ImgParserV6';

export type { ImgFrame, ImgSprite };

export class ImgParser {
  private buffer: ArrayBuffer;
  private view: DataView;

  // Header info
  private magic: string = '';
  private indexSize: number = 0;
  private reserved: number = 0;
  private version: number = 0;
  private indexCount: number = 0;

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
  }

  private parserInstance: any = null;

  public parse(colorBoardIndex: number = 0): ImgFrame[] {
    const magicBytes = new Uint8Array(this.buffer, 0, 16);
    this.magic = new TextDecoder().decode(magicBytes);
    
    const magicStr = 'Neople Img File\x00';
    const magicStrV1 = 'Neople Image Fil';

    if (this.magic !== magicStr && !this.magic.startsWith(magicStrV1)) {
      throw new Error(`Invalid IMG magic string: ${this.magic}`);
    }

    if (this.buffer.byteLength < 32) {
      return [];
    }

    this.indexSize = this.view.getUint32(16, true);
    this.reserved = this.view.getUint32(20, true);
    this.version = this.view.getUint32(24, true);
    this.indexCount = this.view.getUint32(28, true);

    switch (this.version) {
      case 1: {
        this.parserInstance = new ImgParserV1(this.buffer, this.indexSize, this.reserved, this.version, this.indexCount);
        return this.parserInstance.parse(colorBoardIndex);
      }
      case 4: {
        this.parserInstance = new ImgParserV4(this.buffer, this.indexSize, this.reserved, this.version, this.indexCount);
        return this.parserInstance.parse(colorBoardIndex);
      }
      case 5: {
        this.parserInstance = new ImgParserV5(this.buffer, this.indexSize, this.reserved, this.version, this.indexCount);
        return this.parserInstance.parse(colorBoardIndex);
      }
      case 6: {
        this.parserInstance = new ImgParserV6(this.buffer, this.indexSize, this.reserved, this.version, this.indexCount);
        return this.parserInstance.parse(colorBoardIndex);
      }
      case 2:
      case 3:
      default: {
        this.parserInstance = new ImgParserV2(this.buffer, this.indexSize, this.reserved, this.version, this.indexCount);
        return this.parserInstance.parse(colorBoardIndex);
      }
    }
  }

  public getColorBoardCount(): number {
    if (!this.parserInstance) {
      this.parse(0);
    }
    return this.parserInstance?.colorBoards?.length || 0;
  }

  public getColorBoardData(index: number = 0): Uint8ClampedArray | null {
    if (!this.parserInstance || !this.parserInstance.colorBoards) return null;
    return this.parserInstance.colorBoards[index] || null;
  }
}
