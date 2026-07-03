export interface NpkFileEntry {
  name: string;
  offset: number;
  size: number;
  data: ArrayBuffer;
}

export class NpkParser {
  private buffer: ArrayBuffer;
  private view: DataView;

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
  }

  public parse(): NpkFileEntry[] {
    const magicStr = 'NeoplePack_Bill\x00';
    const magicBytes = new Uint8Array(this.buffer, 0, 16);
    const magic = new TextDecoder().decode(magicBytes);

    if (magic !== magicStr) {
      throw new Error(`Invalid NPK magic string: ${magic}`);
    }

    const fileAmount = this.view.getUint32(16, true);

    const keyString =
      'puchikon@neople dungeon and fighter ' +
      'DNFDNFDNFDNFDNFDNFDNFDNFDNFDNFDNF' +
      'DNFDNFDNFDNFDNFDNFDNFDNFDNFDNFDNF' +
      'DNFDNFDNFDNFDNFDNFDNFDNFDNFDNFDNF' +
      'DNFDNFDNFDNFDNFDNFDNFDNFDNFDNFDNF' +
      'DNFDNFDNFDNFDNFDNFDNFDNFDNFDNFDNF' +
      'DNFDNFDNFDNFDNFDNFDNF\x00';

    const keyBytes = new TextEncoder().encode(keyString);

    const files: NpkFileEntry[] = [];
    let pos = 20;

    for (let i = 0; i < fileAmount; i++) {
      const offset = this.view.getUint32(pos, true);
      const size = this.view.getUint32(pos + 4, true);
      const nameBytes = new Uint8Array(this.buffer, pos + 8, 256);

      const isEncrypted = nameBytes[0] !== 0x73 && nameBytes[0] !== 0x00;

      const decryptedNameBytes = new Uint8Array(256);
      for (let j = 0; j < 256; j++) {
        decryptedNameBytes[j] = isEncrypted ? (nameBytes[j] ^ keyBytes[j]) : nameBytes[j];
      }

      let nameLen = 0;
      while (nameLen < 256 && decryptedNameBytes[nameLen] !== 0) {
        nameLen++;
      }

      let name = '';
      try {
        name = new TextDecoder('euc-kr').decode(decryptedNameBytes.subarray(0, nameLen));
      } catch (e) {
        try {
          name = new TextDecoder('utf-8').decode(decryptedNameBytes.subarray(0, nameLen));
        } catch(e2) {
          name = String.fromCharCode(...decryptedNameBytes.subarray(0, nameLen));
        }
      }

      files.push({
        name,
        offset,
        size,
        data: this.buffer.slice(offset, offset + size)
      });

      pos += 264;
    }

    return files;
  }
}
