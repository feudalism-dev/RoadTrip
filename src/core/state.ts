import { CardCategory, CardId, getCard, safetyBlocksHazard, MoveKind, MatchPhase } from './cards'

export type PlayerTableau = {
  displayName: string
  isHuman: boolean
  miles: number
  miles200Played: number
  hand: CardId[]
  battlePile: CardId[]
  speedPile: CardId[]
  safeties: CardId[]
  coupFourreSafeties: CardId[]
}

export type GameMove = {
  kind: MoveKind
  playerIndex: number
  handIndex: number
  card: CardId
  targetPlayerIndex: number
}

export type PendingHazard = {
  attackerIndex: number
  targetIndex: number
  hazard: CardId
  coupDeadlinePlayer: number
}

export type MatchConfig = {
  goalMiles: number
  handSize: number
  maxMiles200: number
  deckCounts: Partial<Record<CardId, number>>
  seed: number
}

export type MatchState = {
  config: MatchConfig
  phase: MatchPhase
  players: PlayerTableau[]
  drawPile: CardId[]
  discardPile: CardId[]
  currentPlayer: number
  winnerIndex: number
  pending: PendingHazard | null
  coupFourreCount: number
  lastMessage: string
  turnNumber: number
}

import { CARD_DEFS } from './cards'

export function defaultConfig(seed = Date.now()): MatchConfig {
  const deckCounts: Partial<Record<CardId, number>> = {}
  for (const d of CARD_DEFS) deckCounts[d.id] = d.defaultCount
  return { goalMiles: 1000, handSize: 6, maxMiles200: 2, deckCounts, seed }
}

export function emptyTableau(name: string, isHuman: boolean): PlayerTableau {
  return {
    displayName: name,
    isHuman,
    miles: 0,
    miles200Played: 0,
    hand: [],
    battlePile: [],
    speedPile: [],
    safeties: [],
    coupFourreSafeties: [],
  }
}

export function battleTop(p: PlayerTableau): CardId | 0 {
  return p.battlePile.length ? p.battlePile[p.battlePile.length - 1]! : 0
}

export function speedTop(p: PlayerTableau): CardId | 0 {
  return p.speedPile.length ? p.speedPile[p.speedPile.length - 1]! : 0
}

export function hasSafety(p: PlayerTableau, safety: CardId): boolean {
  return p.safeties.includes(safety)
}

export function isImmuneTo(p: PlayerTableau, hazard: CardId): boolean {
  return p.safeties.some((s) => safetyBlocksHazard(s, hazard))
}

export function hasEmergencyVehicle(p: PlayerTableau): boolean {
  return hasSafety(p, CardId.EmergencyVehicle)
}

export function speedLimitActive(p: PlayerTableau): boolean {
  if (hasEmergencyVehicle(p)) return false
  return speedTop(p) === CardId.SpeedLimit
}

export function canDrive(p: PlayerTableau): boolean {
  const top = battleTop(p)
  if (top === 0) return hasEmergencyVehicle(p)
  const def = getCard(top)
  // Hazards stop you cold.
  if (def.category === CardCategory.Hazard && def.isBattleHazard) return false
  // Drive OR any battle remedy (Spare Tire, Gasoline, etc.) means you're moving.
  // House rule: fixes restore GO so the race does not stall on double-taxes.
  if (def.category === CardCategory.Remedy) return true
  return false
}

/** True when a battle hazard can be played onto this tableau (they are "on the road"). */
export function isAttackableBattleTarget(p: PlayerTableau): boolean {
  const top = battleTop(p)
  if (top === 0) return false
  const def = getCard(top)
  if (def.category === CardCategory.Hazard && def.isBattleHazard) return false
  return def.category === CardCategory.Remedy
}

export function playMove(player: number, handIndex: number, card: CardId, target = -1): GameMove {
  return { kind: MoveKind.Play, playerIndex: player, handIndex, card, targetPlayerIndex: target }
}

export function discardMove(player: number, handIndex: number, card: CardId): GameMove {
  return { kind: MoveKind.Discard, playerIndex: player, handIndex, card, targetPlayerIndex: -1 }
}

export function coupMove(player: number, handIndex: number, safety: CardId): GameMove {
  return { kind: MoveKind.CoupFourre, playerIndex: player, handIndex, card: safety, targetPlayerIndex: -1 }
}

export function cloneState(state: MatchState): MatchState {
  return structuredClone(state)
}
