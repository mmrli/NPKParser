export function paletteRgbaToCssColors(data: ArrayLike<number> | undefined): string[] {
  if (!data) return []

  const colors: string[] = []
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    colors.push(`rgba(${r}, ${g}, ${b}, ${a / 255})`)
  }
  return colors
}
