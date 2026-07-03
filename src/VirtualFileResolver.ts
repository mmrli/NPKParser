import type { NpkParser } from './NpkParser';

export interface NpkSourceEntry {
  name: string
  source: string
  buffer?: ArrayBuffer
  entries?: ReturnType<NpkParser['parse']>
  fetchData?: () => Promise<ArrayBuffer>
}

export function buildNpkIndex(npkFiles: { name: string; buffer: ArrayBuffer; entries: ReturnType<NpkParser['parse']> }[]) {
  const map = new Map<string, NpkSourceEntry>()
  for (const { name: npkName, buffer, entries } of npkFiles) {
    for (const entry of entries) {
      if (entry.name.toLowerCase().endsWith('.img')) {
        const normalized = entry.name.replace(/\\/g, '/').toLowerCase()
        map.set(normalized, { name: entry.name, source: npkName, buffer, entries })
      }
    }
  }
  return map
}

export function resolveImgFromNpk(
  aniImagePath: string,
  frameIndex: number,
  npkIndex: Map<string, NpkSourceEntry>
): NpkSourceEntry | null {
  const normalized = aniImagePath.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase()
  const resolvedPath = /%0\d+d/.test(normalized)
    ? normalized.replace(/%0(\d+)d/g, (_: string, w: string) => String(frameIndex).padStart(Number(w), '0'))
    : normalized

  const direct = npkIndex.get(resolvedPath)
  if (direct) return direct

  const withSprite = npkIndex.get(`sprite/${resolvedPath}`)
  if (withSprite) return withSprite

  const suffix = resolvedPath.split('/').pop()!
  for (const [k, v] of npkIndex) {
    if (k.endsWith(`/${suffix}`) || k.endsWith(suffix)) return v
  }

  return null
}
