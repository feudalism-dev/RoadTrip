import { CardId } from '../core/cards'

/** Public asset URLs (Vite `base` aware). */
const base = import.meta.env.BASE_URL

const CARD_FACE: Record<CardId, string> = {
  [CardId.Miles25]: 'card-face-miles-25.png',
  [CardId.Miles50]: 'card-face-miles-50.png',
  [CardId.Miles75]: 'card-face-miles-75.png',
  [CardId.Miles100]: 'card-face-miles-100.png',
  [CardId.Miles200]: 'card-face-miles-200.png',
  [CardId.RedLight]: 'card-face-red-light.png',
  [CardId.Accident]: 'card-face-accident.png',
  [CardId.OutOfGas]: 'card-face-out-of-gas.png',
  [CardId.FlatTire]: 'card-face-flat-tire.png',
  [CardId.SpeedLimit]: 'card-face-speed-limit.png',
  [CardId.TrafficJam]: 'card-face-traffic-jam.png',
  [CardId.GpsError]: 'card-face-gps-error.png',
  [CardId.Drive]: 'card-face-drive.png',
  [CardId.Repairs]: 'card-face-repairs.png',
  [CardId.Gasoline]: 'card-face-gasoline.png',
  [CardId.SpareTire]: 'card-face-spare-tire.png',
  [CardId.EndOfLimit]: 'card-face-end-of-limit.png',
  [CardId.TrafficClear]: 'card-face-traffic-clear.png',
  [CardId.NavigationFix]: 'card-face-nav-fix.png',
  [CardId.EmergencyVehicle]: 'card-face-emergency-vehicle.png',
  [CardId.DrivingAce]: 'card-face-driving-ace.png',
  [CardId.ExtraTank]: 'card-face-extra-tank.png',
  [CardId.PunctureProof]: 'card-face-puncture-proof.png',
  [CardId.FastLane]: 'card-face-fast-lane.png',
  [CardId.GpsLock]: 'card-face-gps-lock.png',
}

export function cardFaceUrl(id: CardId): string {
  return `${base}assets/cards/${CARD_FACE[id]}`
}

export const assets = {
  felt: `${base}assets/felt-table.png`,
  wood: `${base}assets/wood-rail.png`,
  cardBack: `${base}assets/card-back.png`,
  highway: `${base}assets/highway-strip.png`,
  carPlayer: `${base}assets/car-player.png`,
  carOpponent: `${base}assets/car-opponent.png`,
  menuHero: `${base}assets/ui-menu-hero.png`,
  plaque: `${base}assets/ui-plaque.png`,
  counterBurst: `${base}assets/ui-coup-burst.png`,
} as const
