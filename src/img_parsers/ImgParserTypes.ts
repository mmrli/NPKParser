export interface ImgFrame {
  frameIndex: number;
  type: 'image' | 'link';
  target?: number; // for link type
  color?: number;
  comp?: number;
  w: number;
  h: number;
  size?: number;
  x: number;
  y: number;
  fw: number;
  fh: number;
  imageData?: ImageData;
  rawPixelData?: Uint8Array;
  rawDataOffset?: number;
  // Custom props for v5 sprite composition
  spriteIndex?: number;
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  rotate?: number;
}

export interface ImgSprite {
  fmt: number;
  index: number;
  dataSize: number;
  rawSize: number;
  w: number;
  h: number;
  offset: number;
}
