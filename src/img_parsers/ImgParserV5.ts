import pako from 'pako';
import type { ImgFrame } from './ImgParserTypes';
import { ImgParserBase } from './ImgParserBase';

export class ImgParserV5 extends ImgParserBase {
  public parse(colorBoardIndex: number = 0): ImgFrame[] {
    let pos = 32;
    const spriteCount = this.view.getUint32(pos, true); pos += 4;
    pos += 4; // skip fileSize

    const colorCount = this.view.getUint32(pos, true); pos += 4;
    if (colorCount > 0) {
      const cbBuffer = new Uint8ClampedArray(this.buffer, pos, colorCount * 4);
      this.colorBoards.push(cbBuffer);
      pos += colorCount * 4;
    }

    for (let i = 0; i < spriteCount; i++) {
      this.view.getUint32(pos, true); pos += 4; // keep
      const fmt = this.view.getUint32(pos, true); pos += 4; 
      const index = this.view.getUint32(pos, true); pos += 4;
      const dataSize = this.view.getUint32(pos, true); pos += 4;
      const rawSize = this.view.getUint32(pos, true); pos += 4;
      const w = this.view.getUint32(pos, true); pos += 4;
      const h = this.view.getUint32(pos, true); pos += 4;
      this.sprites.push({
        fmt, index, dataSize, rawSize, w, h, offset: 0
      });
    }

    const entries: ImgFrame[] = [];

    for (let i = 0; i < this.indexCount; i++) {
      const typeVal = this.view.getUint32(pos, true);
      pos += 4;

      if (typeVal === 0x11) {
        const targetFrame = this.view.getUint32(pos, true);
        pos += 4;
        entries.push({
          frameIndex: i,
          type: 'link',
          target: targetFrame,
          w: 0, h: 0, x: 0, y: 0, fw: 0, fh: 0,
          rawDataOffset: -1
        });
      } else {
        const colorSys = typeVal;
        const compState = this.view.getUint32(pos, true); pos += 4;
        const width = this.view.getUint32(pos, true); pos += 4;
        const height = this.view.getUint32(pos, true); pos += 4;
        const size = this.view.getUint32(pos, true); pos += 4;
        const x = this.view.getInt32(pos, true); pos += 4;
        const y = this.view.getInt32(pos, true); pos += 4;
        const frameW = this.view.getUint32(pos, true); pos += 4;
        const frameH = this.view.getUint32(pos, true); pos += 4;

        if (compState === 7) {
          pos += 4; // skip keep
          const spriteIndex = this.view.getUint32(pos, true); pos += 4;
          const left = this.view.getUint32(pos, true); pos += 4;
          const top = this.view.getUint32(pos, true); pos += 4;
          const right = this.view.getUint32(pos, true); pos += 4;
          const bottom = this.view.getUint32(pos, true); pos += 4;
          const rotate = this.view.getUint32(pos, true); pos += 4;
          
          entries.push({
            frameIndex: i,
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
            spriteIndex,
            left, top, right, bottom, rotate,
            rawDataOffset: -1
          });
        } else {
          entries.push({
            frameIndex: i,
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
          });
        }
      }
    }

    let offset = pos;
    for (const sprite of this.sprites) {
      sprite.offset = offset;
      offset += sprite.dataSize;
    }
    pos = offset;

    for (let i = 0; i < this.indexCount; i++) {
      const entry = entries[i];
      if (entry.type === 'link') {
        this.extractLinkFrame(entry, entries);
        continue;
      }

      if (entry.comp === 0 && entry.size === 0) continue;
      
      if (entry.w === 0 || entry.h === 0) {
        if (entry.comp !== 7) continue;
      }

      let rawData = new Uint8Array(0);
      if (entry.size! > 0) {
        if (pos + entry.size! > this.buffer.byteLength) {
          console.warn(`[ImgParserV5] Frame ${i} data exceeds buffer bounds, skipping.`);
          continue;
        }
        rawData = new Uint8Array(this.buffer, pos, entry.size!);
        pos += entry.size!;
      }

      let pixelData: Uint8Array;
      if (entry.comp === 6 || entry.comp === 7) {
        if (entry.comp === 7) {
          this.decodeV5Sprite(entry);
          continue;
        }

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

  private decodeV5Sprite(entry: ImgFrame) {
    const spriteData = entry;
    let spriteInfo = this.sprites.find(s => s.index === spriteData.spriteIndex);
    if (!spriteInfo && spriteData.spriteIndex !== undefined && spriteData.spriteIndex < this.sprites.length) {
      spriteInfo = this.sprites[spriteData.spriteIndex];
    }
    if (!spriteInfo) return;

    const rawSpriteData = new Uint8Array(this.buffer, spriteInfo.offset, spriteInfo.dataSize);
    let decompressedSprite: Uint8Array;
    try {
      let zlibData = rawSpriteData;
      if (zlibData[0] === 0x78) {
        decompressedSprite = pako.inflate(zlibData);
      } else {
        const headerIndex = zlibData.lastIndexOf(0x78);
        if (headerIndex !== -1) {
          try {
            const combined = new Uint8Array(zlibData.length - headerIndex + zlibData.length);
            combined.set(zlibData.subarray(headerIndex));
            combined.set(zlibData, zlibData.length - headerIndex);
            decompressedSprite = pako.inflate(combined);
          } catch {
            try {
              const headerBytes = zlibData.slice(headerIndex, headerIndex + 2);
              const combined = new Uint8Array(headerBytes.length + zlibData.length);
              combined.set(headerBytes);
              combined.set(zlibData, headerBytes.length);
              decompressedSprite = pako.inflate(combined);
            } catch {
              decompressedSprite = pako.inflate(zlibData);
            }
          }
        } else {
          decompressedSprite = pako.inflate(zlibData);
        }
      }
    } catch (e) {
      console.error(`Sprite ${spriteData.spriteIndex} failed to decompress. rawSize: ${rawSpriteData.length}, expected: ${spriteInfo.rawSize}`, e);
      return;
    }

    const sw = spriteInfo.w;
    const sh = spriteInfo.h;
    const sRgba = new Uint8ClampedArray(sw * sh * 4);

    if (spriteInfo.fmt === 16 || spriteInfo.fmt === 3) {
      for (let j = 0; j < sw * sh; j++) {
        sRgba[j * 4 + 0] = decompressedSprite[j * 4 + 2];
        sRgba[j * 4 + 1] = decompressedSprite[j * 4 + 1];
        sRgba[j * 4 + 2] = decompressedSprite[j * 4 + 0];
        sRgba[j * 4 + 3] = decompressedSprite[j * 4 + 3];
      }
    } else if (spriteInfo.fmt === 15 || spriteInfo.fmt === 2) {
      const dataView = new DataView(decompressedSprite.buffer, decompressedSprite.byteOffset, decompressedSprite.byteLength);
      for (let j = 0; j < sw * sh; j++) {
        const p = dataView.getUint16(j * 2, true);
        const a = (p >> 12) & 0xF;
        const r = (p >> 8) & 0xF;
        const g = (p >> 4) & 0xF;
        const b = p & 0xF;
        sRgba[j * 4 + 0] = (r << 4) | r;
        sRgba[j * 4 + 1] = (g << 4) | g;
        sRgba[j * 4 + 2] = (b << 4) | b;
        sRgba[j * 4 + 3] = (a << 4) | a;
      }
    } else if (spriteInfo.fmt === 14 || spriteInfo.fmt === 1) {
      const dataView = new DataView(decompressedSprite.buffer, decompressedSprite.byteOffset, decompressedSprite.byteLength);
      for (let j = 0; j < sw * sh; j++) {
        const p = dataView.getUint16(j * 2, true);
        const a = (p & 0x8000) ? 255 : 0;
        const r = (p >> 10) & 0x1F;
        const g = (p >> 5) & 0x1F;
        const b = p & 0x1F;
        sRgba[j * 4 + 0] = (r << 3) | (r >> 2);
        sRgba[j * 4 + 1] = (g << 3) | (g >> 2);
        sRgba[j * 4 + 2] = (b << 3) | (b >> 2);
        sRgba[j * 4 + 3] = a;
      }
    } else if (spriteInfo.fmt === 18 || spriteInfo.fmt === 19 || spriteInfo.fmt === 4 || spriteInfo.fmt === 5) {
        let offset = 0;
        if (decompressedSprite.length > 128 && decompressedSprite[0] === 0x44 && decompressedSprite[1] === 0x44 && decompressedSprite[2] === 0x53 && decompressedSprite[3] === 0x20) {
          offset = 128;
        }
        
        const isDxt1 = (spriteInfo.fmt === 18 || spriteInfo.fmt === 4);
        const bw = Math.ceil(sw / 4);
        const bh = Math.ceil(sh / 4);
        
        for (let by = 0; by < bh; by++) {
          for (let bx = 0; bx < bw; bx++) {
            if (offset + 8 > decompressedSprite.length) break;
            
            let aBlock = new Uint8Array(16);
            if (!isDxt1) {
              if (offset + 16 > decompressedSprite.length) break;
              for (let i = 0; i < 8; i++) {
                const alphaData = decompressedSprite[offset + i];
                aBlock[i * 2] = (alphaData & 0xF) * 17;
                aBlock[i * 2 + 1] = ((alphaData >> 4) & 0xF) * 17;
              }
              offset += 8;
            } else {
              aBlock.fill(255);
            }
            
            const dataView = new DataView(decompressedSprite.buffer, decompressedSprite.byteOffset + offset, 8);
            const c0 = dataView.getUint16(0, true);
            const c1 = dataView.getUint16(2, true);
            const cData = dataView.getUint32(4, true);
            
            const cPal = new Uint8Array(16);
            cPal[0] = ((c0 >> 11) & 31) << 3; cPal[1] = ((c0 >> 5) & 63) << 2; cPal[2] = (c0 & 31) << 3; cPal[3] = 255;
            cPal[4] = ((c1 >> 11) & 31) << 3; cPal[5] = ((c1 >> 5) & 63) << 2; cPal[6] = (c1 & 31) << 3; cPal[7] = 255;
            
            if (c0 > c1 || !isDxt1) {
              cPal[8] = Math.floor((2 * cPal[0] + cPal[4]) / 3);
              cPal[9] = Math.floor((2 * cPal[1] + cPal[5]) / 3);
              cPal[10] = Math.floor((2 * cPal[2] + cPal[6]) / 3);
              cPal[11] = 255;
              
              cPal[12] = Math.floor((cPal[0] + 2 * cPal[4]) / 3);
              cPal[13] = Math.floor((cPal[1] + 2 * cPal[5]) / 3);
              cPal[14] = Math.floor((cPal[2] + 2 * cPal[6]) / 3);
              cPal[15] = 255;
            } else {
              cPal[8] = Math.floor((cPal[0] + cPal[4]) / 2);
              cPal[9] = Math.floor((cPal[1] + cPal[5]) / 2);
              cPal[10] = Math.floor((cPal[2] + cPal[6]) / 2);
              cPal[11] = 255;
              
              cPal[12] = 0; cPal[13] = 0; cPal[14] = 0; cPal[15] = 0;
            }
            
            for (let i = 0; i < 16; i++) {
              const py = Math.floor(i / 4);
              const px = i % 4;
              const destX = bx * 4 + px;
              const destY = by * 4 + py;
              if (destX < sw && destY < sh) {
                const idx = (cData >> (i * 2)) & 3;
                const pixelIdx = (destY * sw + destX) * 4;
                sRgba[pixelIdx + 0] = cPal[idx * 4 + 0];
                sRgba[pixelIdx + 1] = cPal[idx * 4 + 1];
                sRgba[pixelIdx + 2] = cPal[idx * 4 + 2];
                sRgba[pixelIdx + 3] = (isDxt1 && idx === 3 && c0 <= c1) ? 0 : aBlock[i];
              }
            }
            offset += 8;
          }
        }
    } else if (spriteInfo.fmt === 20 || spriteInfo.fmt === 6) {
        let offset = 0;
        if (decompressedSprite.length > 128 && decompressedSprite[0] === 0x44 && decompressedSprite[1] === 0x44 && decompressedSprite[2] === 0x53 && decompressedSprite[3] === 0x20) {
          offset = 128;
        }
        
        const bw = Math.ceil(sw / 4);
        const bh = Math.ceil(sh / 4);
        
        for (let by = 0; by < bh; by++) {
          for (let bx = 0; bx < bw; bx++) {
            if (offset + 16 > decompressedSprite.length) break;
            
            const a0 = decompressedSprite[offset];
            const a1 = decompressedSprite[offset + 1];
            const aData = new Uint8Array(6);
            aData[0] = decompressedSprite[offset + 2]; aData[1] = decompressedSprite[offset + 3];
            aData[2] = decompressedSprite[offset + 4]; aData[3] = decompressedSprite[offset + 5];
            aData[4] = decompressedSprite[offset + 6]; aData[5] = decompressedSprite[offset + 7];
            
            const aBlock = new Uint8Array(16);
            const aPal = new Uint8Array(8);
            aPal[0] = a0; aPal[1] = a1;
            if (a0 > a1) {
              for (let i = 2; i < 8; i++) aPal[i] = Math.floor(((8 - i) * a0 + (i - 1) * a1) / 7);
            } else {
              for (let i = 2; i < 6; i++) aPal[i] = Math.floor(((6 - i) * a0 + (i - 1) * a1) / 5);
              aPal[6] = 0; aPal[7] = 255;
            }
            
            let aIndexData = 0n;
            for (let i = 0; i < 6; i++) aIndexData |= BigInt(aData[i]) << BigInt(i * 8);
            for (let i = 0; i < 16; i++) aBlock[i] = aPal[Number((aIndexData >> BigInt(i * 3)) & 7n)];
            
            offset += 8;
            
            const dataView = new DataView(decompressedSprite.buffer, decompressedSprite.byteOffset + offset, 8);
            const c0 = dataView.getUint16(0, true);
            const c1 = dataView.getUint16(2, true);
            const cData = dataView.getUint32(4, true);
            
            const cPal = new Uint8Array(16);
            cPal[0] = ((c0 >> 11) & 31) << 3; cPal[1] = ((c0 >> 5) & 63) << 2; cPal[2] = (c0 & 31) << 3; cPal[3] = 255;
            cPal[4] = ((c1 >> 11) & 31) << 3; cPal[5] = ((c1 >> 5) & 63) << 2; cPal[6] = (c1 & 31) << 3; cPal[7] = 255;
            
            cPal[8] = Math.floor((2 * cPal[0] + cPal[4]) / 3); cPal[9] = Math.floor((2 * cPal[1] + cPal[5]) / 3);
            cPal[10] = Math.floor((2 * cPal[2] + cPal[6]) / 3); cPal[11] = 255;
            
            cPal[12] = Math.floor((cPal[0] + 2 * cPal[4]) / 3); cPal[13] = Math.floor((cPal[1] + 2 * cPal[5]) / 3);
            cPal[14] = Math.floor((cPal[2] + 2 * cPal[6]) / 3); cPal[15] = 255;
            
            for (let i = 0; i < 16; i++) {
              const py = Math.floor(i / 4);
              const px = i % 4;
              const destX = bx * 4 + px;
              const destY = by * 4 + py;
              if (destX < sw && destY < sh) {
                const idx = (cData >> (i * 2)) & 3;
                const pixelIdx = (destY * sw + destX) * 4;
                sRgba[pixelIdx + 0] = cPal[idx * 4 + 0];
                sRgba[pixelIdx + 1] = cPal[idx * 4 + 1];
                sRgba[pixelIdx + 2] = cPal[idx * 4 + 2];
                sRgba[pixelIdx + 3] = aBlock[i];
              }
            }
            offset += 8;
          }
        }
    }

    const ew = entry.w;
    const eh = entry.h;
    const eRgba = new Uint8ClampedArray(ew * eh * 4);
    const { left, top, rotate } = spriteData;
    const isRotated = (rotate === 1);
    
    if (!isRotated) {
      for (let ey = 0; ey < eh; ey++) {
        for (let ex = 0; ex < ew; ex++) {
          const sx = left! + ex;
          const sy = top! + ey;
          if (sx >= 0 && sx < sw && sy >= 0 && sy < sh) {
            const sIdx = (sy * sw + sx) * 4;
            const eIdx = (ey * ew + ex) * 4;
            eRgba[eIdx] = sRgba[sIdx];
            eRgba[eIdx+1] = sRgba[sIdx+1];
            eRgba[eIdx+2] = sRgba[sIdx+2];
            eRgba[eIdx+3] = sRgba[sIdx+3];
          }
        }
      }
    } else {
      for (let ey = 0; ey < eh; ey++) {
        for (let ex = 0; ex < ew; ex++) {
          const sx = left! + (eh - 1 - ey); 
          const sy = top! + ex;
          if (sx >= 0 && sx < sw && sy >= 0 && sy < sh) {
            const sIdx = (sy * sw + sx) * 4;
            const eIdx = (ey * ew + ex) * 4;
            eRgba[eIdx] = sRgba[sIdx];
            eRgba[eIdx+1] = sRgba[sIdx+1];
            eRgba[eIdx+2] = sRgba[sIdx+2];
            eRgba[eIdx+3] = sRgba[sIdx+3];
          }
        }
      }
    }

    entry.imageData = new ImageData(eRgba, ew, eh);
  }
}
