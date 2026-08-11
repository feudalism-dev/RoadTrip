import { CardCategory, CardId, MatchPhase, MoveKind, getCard } from '../core/cards'
import type { GameMove, MatchState } from '../core/state'
import { cloneState } from '../core/state'
import { getLegalMoves, tryApply } from '../core/rules'

export type AiDifficulty = 'easy' | 'normal' | 'hard'

export function chooseAiMove(state: MatchState, playerIndex: number, difficulty: AiDifficulty): GameMove | null {
  if (state.phase === MatchPhase.AwaitingCoupFourre) {
    const coups = getLegalMoves(state).filter((m) => m.kind === MoveKind.CoupFourre)
    return coups[0] ?? null
  }

  const legal = getLegalMoves(state)
  if (!legal.length) return null
  const plays = legal.filter((m) => m.kind !== MoveKind.Discard)
  const discards = legal.filter((m) => m.kind === MoveKind.Discard)
  if (!plays.length) return pickDiscard(state, playerIndex, discards)

  let best: GameMove | null = null
  let bestScore = -Infinity
  for (const move of plays) {
    let score = scorePlay(state, move)
    if (difficulty === 'easy') score += (Math.random() - 0.5) * 80
    if (difficulty === 'hard') score += lookaheadBonus(state, move)
    if (score > bestScore) {
      bestScore = score
      best = move
    }
  }
  if (difficulty === 'easy' && plays.length > 1 && Math.random() < 0.25) {
    return plays[Math.floor(Math.random() * plays.length)]!
  }
  return best ?? pickDiscard(state, playerIndex, discards)
}

function lookaheadBonus(state: MatchState, move: GameMove): number {
  const clone = cloneState(state)
  const res = tryApply(clone, move)
  if (!res.ok) return -1000
  if (clone.phase === MatchPhase.Finished && clone.winnerIndex === move.playerIndex) return 5000
  const me = clone.players[move.playerIndex]!.miles
  const lead = Math.max(0, ...clone.players.filter((_, i) => i !== move.playerIndex).map((p) => p.miles))
  return me - lead
}

function scorePlay(state: MatchState, move: GameMove): number {
  const me = state.players[move.playerIndex]!
  const def = getCard(move.card)
  if (def.category === CardCategory.Distance) {
    const next = me.miles + def.miles
    if (next === state.config.goalMiles) return 100000
    let score = def.miles
    if (state.config.goalMiles - next < 50) score += 80
    if (def.miles === 200) score += 30
    return score
  }
  if (def.category === CardCategory.Remedy) return 200 + (move.card === CardId.Drive ? 40 : 0)
  if (def.category === CardCategory.Safety) {
    let score = 260
    const leader = Math.max(0, ...state.players.filter((_, i) => i !== move.playerIndex).map((p) => p.miles))
    if (leader >= 800) score += 80
    return score
  }
  if (def.category === CardCategory.Hazard) {
    const target = state.players[move.targetPlayerIndex]!
    return 150 + target.miles / 5 + (target.miles >= 700 ? 100 : 0)
  }
  return 0
}

function pickDiscard(state: MatchState, playerIndex: number, discards: GameMove[]): GameMove | null {
  if (!discards.length) return null
  let best = discards[0]!
  let bestScore = -Infinity
  for (const d of discards) {
    const s = discardValue(state, playerIndex, d.card)
    if (s > bestScore) {
      bestScore = s
      best = d
    }
  }
  return best
}

function discardValue(state: MatchState, playerIndex: number, card: CardId): number {
  const def = getCard(card)
  const me = state.players[playerIndex]!
  if (def.category === CardCategory.Distance) {
    if (me.miles + def.miles > state.config.goalMiles) return 500
    return 100 - def.miles
  }
  if (def.category === CardCategory.Hazard) return 60
  if (def.category === CardCategory.Remedy) return 40
  if (def.category === CardCategory.Safety) return 10
  return 50
}
