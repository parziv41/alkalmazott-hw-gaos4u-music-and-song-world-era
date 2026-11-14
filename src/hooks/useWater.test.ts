import { describe, expect, it } from 'vitest'
import { decode, thin, waterForZoom, type Water } from './useWater'

describe('decode', () => {
  it('turns steps in thousandths of a degree back into coordinates', () => {
    expect(decode([19040, 47498, 3, -2, -1, 0])).toEqual([
      [19.04, 47.498],
      [19.043, 47.496],
      [19.042, 47.496],
    ])
  })
})

describe('thinning for the zoom', () => {
  it('drops points closer than the tolerance and keeps both ends', () => {
    const line: [number, number][] = [[0, 0], [0.001, 0], [0.002, 0], [0.5, 0], [0.5005, 0], [1, 0]]
    expect(thin(line, 0.1)).toEqual([[0, 0], [0.5, 0], [1, 0]])
    expect(thin([[0, 0], [1, 1]], 5)).toEqual([[0, 0], [1, 1]])
  })

  it('computes each zoom step once, with fewer points from afar', () => {
    const coordinates = Array.from({ length: 1000 }, (_, i) => [i / 1000, 0] as [number, number])
    const water: Water = { rivers: [{ name: 'R', hu: '', k: 1, line: { type: 'LineString', coordinates }, centroid: [0.5, 0], radius: 0.01 }], lakes: [] }
    const far = waterForZoom(water, 3, 380)
    const near = waterForZoom(water, 40, 380)
    expect(waterForZoom(water, 3.1, 380)).toBe(far)
    expect(far.rivers[0].line.coordinates.length).toBeLessThan(near.rivers[0].line.coordinates.length)
    expect(near.rivers[0].line.coordinates.length).toBeLessThan(1000)
  })
})
