/** Public asset URLs (Vite `base` aware). */
const base = import.meta.env.BASE_URL

export const assets = {
  felt: `${base}assets/felt-table.png`,
  wood: `${base}assets/wood-rail.png`,
  cardBack: `${base}assets/card-back.png`,
  highway: `${base}assets/highway-strip.png`,
  carPlayer: `${base}assets/car-player.png`,
  carOpponent: `${base}assets/car-opponent.png`,
} as const
