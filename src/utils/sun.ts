// Where the sun is overhead right now, for the day–night shading on the globe. NOAA's low-precision
// solar position formulas: good to a fraction of a degree, which is plenty for a terminator.

const DEG = 180 / Math.PI
const wrap = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180

/** The point on Earth where the sun is directly overhead at `date`, as [lon, lat]. */
export function subsolarPoint(date: Date): [number, number] {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1)
  const dayOfYear = Math.floor((date.getTime() - startOfYear) / 86_400_000) + 1
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  // Fractional year, in radians.
  const g = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (hours - 12) / 24)
  const declination =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g)
  // How far the sun runs ahead of or behind clock time, in minutes.
  const equationOfTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g))
  return [wrap(-15 * (hours - 12 + equationOfTime / 60)), declination * DEG]
}

/** The middle of the night side: the point opposite the sun. */
export function antisolarPoint(date: Date): [number, number] {
  const [lon, lat] = subsolarPoint(date)
  return [wrap(lon + 180), -lat]
}
