import { CardCategory, CardId, MatchPhase, MoveKind, getCard, safetyBlocksHazard, safetyForHazard, CARD_DEFS } from './cards'
import {
  battleTop,
  speedTop,
  canDrive,
  isAttackableBattleTarget,
  hasEmergencyVehicle,
  isImmuneTo,
  hasSafety,
  speedLimitActive,
  emptyTableau,
  defaultConfig,
  playMove,
  discardMove,
  coupMove,
} from './state'
import type { MatchConfig, MatchState, GameMove, PlayerTableau } from './state'

export { defaultConfig, playMove, discardMove, coupMove }
export type { MatchState, GameMove, MatchConfig, PlayerTableau }

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
}

function buildDeck(config: MatchConfig): CardId[] {
  const deck: CardId[] = []
  for (const [id, count] of Object.entries(config.deckCounts)) {
    const card = Number(id) as CardId
    for (let i = 0; i < (count ?? 0); i++) deck.push(card)
  }
  return deck
}

function drawToHand(state: MatchState, playerIndex: number): void {
  if (!state.drawPile.length) return
  state.players[playerIndex]!.hand.push(state.drawPile.pop()!)
}

export function createMatch(
  names: string[],
  humanFlags: boolean[],
  config?: MatchConfig,
): MatchState {
  if (names.length < 2) throw new Error('Need at least 2 players')
  const cfg = config ?? defaultConfig()
  const rand = mulberry32(cfg.seed || Date.now())
  const drawPile = buildDeck(cfg)
  shuffle(drawPile, rand)

  const state: MatchState = {
    config: cfg,
    phase: MatchPhase.Playing,
    players: names.map((n, i) => emptyTableau(n, !!humanFlags[i])),
    drawPile,
    discardPile: [],
    currentPlayer: 0,
    winnerIndex: -1,
    pending: null,
    coupFourreCount: 0,
    lastMessage: `${names[0]} starts the road trip.`,
    turnNumber: 1,
  }

  for (let c = 0; c < cfg.handSize; c++) {
    for (let p = 0; p < state.players.length; p++) drawToHand(state, p)
  }
  drawToHand(state, 0)
  return state
}

export function canPlayDistance(state: MatchState, playerIndex: number, card: CardId): boolean {
  const me = state.players[playerIndex]!
  const def = getCard(card)
  if (!canDrive(me)) return false
  if (me.miles + def.miles > state.config.goalMiles) return false
  if (def.miles === 200 && me.miles200Played >= state.config.maxMiles200) return false
  if (speedLimitActive(me) && def.miles > 50) return false
  return true
}

export function canPlayRemedy(state: MatchState, playerIndex: number, card: CardId): boolean {
  const me = state.players[playerIndex]!
  if (card === CardId.Drive) {
    const top = battleTop(me)
    if (top === 0 || top === CardId.RedLight) return true
    const topDef = getCard(top)
    if (topDef.category === CardCategory.Remedy && top !== CardId.Drive) return true
    return false
  }
  if (card === CardId.EndOfLimit) {
    return speedTop(me) === CardId.SpeedLimit && !hasEmergencyVehicle(me)
  }
  return battleTop(me) === getCard(card).countersHazard
}

export function canPlayHazard(state: MatchState, attacker: number, target: number, hazard: CardId): boolean {
  void attacker
  const victim = state.players[target]!
  if (isImmuneTo(victim, hazard)) return false
  const def = getCard(hazard)
  if (def.isSpeedHazard) {
    const top = speedTop(victim)
    return top === 0 || top === CardId.EndOfLimit
  }
  return isAttackableBattleTarget(victim)
}

export function getLegalMoves(state: MatchState): GameMove[] {
  const moves: GameMove[] = []
  if (state.phase === MatchPhase.Finished) return moves

  if (state.phase === MatchPhase.AwaitingCoupFourre && state.pending) {
    const target = state.pending.targetIndex
    const victim = state.players[target]!
    victim.hand.forEach((card, i) => {
      if (safetyBlocksHazard(card, state.pending!.hazard)) {
        moves.push(coupMove(target, i, card))
      }
    })
    return moves
  }

  const p = state.currentPlayer
  const me = state.players[p]!
  me.hand.forEach((card, i) => {
    const def = getCard(card)
    if (def.category === CardCategory.Distance && canPlayDistance(state, p, card)) {
      moves.push(playMove(p, i, card))
    } else if (def.category === CardCategory.Remedy && canPlayRemedy(state, p, card)) {
      moves.push(playMove(p, i, card))
    } else if (def.category === CardCategory.Safety && !hasSafety(me, card)) {
      moves.push(playMove(p, i, card))
    } else if (def.category === CardCategory.Hazard) {
      for (let t = 0; t < state.players.length; t++) {
        if (t === p) continue
        if (canPlayHazard(state, p, t, card)) moves.push(playMove(p, i, card, t))
      }
    }
    moves.push(discardMove(p, i, card))
  })
  return moves
}

function applyHazard(victim: PlayerTableau, hazard: CardId): void {
  if (hazard === CardId.SpeedLimit) victim.speedPile.push(hazard)
  else victim.battlePile.push(hazard)
}

function undoHazard(victim: PlayerTableau, hazard: CardId): void {
  if (hazard === CardId.SpeedLimit) {
    if (speedTop(victim) === hazard) victim.speedPile.pop()
  } else if (battleTop(victim) === hazard) {
    victim.battlePile.pop()
  }
}

function playSafety(state: MatchState, playerIndex: number, safety: CardId, coup: boolean): void {
  const me = state.players[playerIndex]!
  me.safeties.push(safety)
  if (coup) me.coupFourreSafeties.push(safety)

  if (safety === CardId.EmergencyVehicle) {
    if (battleTop(me) === CardId.RedLight) state.discardPile.push(me.battlePile.pop()!)
    if (speedTop(me) === CardId.SpeedLimit) state.discardPile.push(me.speedPile.pop()!)
  } else {
    for (const d of CARD_DEFS) {
      if (d.category !== CardCategory.Hazard) continue
      if (safetyForHazard(d.id) === safety && battleTop(me) === d.id) {
        state.discardPile.push(me.battlePile.pop()!)
        break
      }
    }
  }
}

function finishByExhaustion(state: MatchState): void {
  state.phase = MatchPhase.Finished
  let best = 0
  let bestMiles = -1
  state.players.forEach((p, i) => {
    if (p.miles > bestMiles) {
      bestMiles = p.miles
      best = i
    }
  })
  state.winnerIndex = best
  state.lastMessage = `Deck exhausted. ${state.players[best]!.displayName} leads with ${bestMiles} miles.`
}

function endTurn(state: MatchState): void {
  if (state.phase === MatchPhase.Finished) return
  const handsEmpty = state.players.every((p) => p.hand.length === 0)
  if (!state.drawPile.length && handsEmpty) {
    finishByExhaustion(state)
    return
  }

  let guard = 0
  do {
    state.currentPlayer = (state.currentPlayer + 1) % state.players.length
    guard++
  } while (
    state.players[state.currentPlayer]!.hand.length === 0 &&
    !state.drawPile.length &&
    guard < state.players.length + 1
  )

  state.turnNumber++
  drawToHand(state, state.currentPlayer)
  if (!state.players[state.currentPlayer]!.hand.length && !state.drawPile.length) {
    finishByExhaustion(state)
  }
}

export function declineCoupFourre(state: MatchState): { ok: true } | { ok: false; error: string } {
  if (state.phase !== MatchPhase.AwaitingCoupFourre || !state.pending) {
    return { ok: false, error: 'No Coup Fourré pending.' }
  }
  state.lastMessage = `${state.players[state.pending.targetIndex]!.displayName} could not Coup Fourré.`
  state.pending = null
  state.phase = MatchPhase.Playing
  endTurn(state)
  return { ok: true }
}

export function tryApply(state: MatchState, move: GameMove): { ok: true } | { ok: false; error: string } {
  if (state.phase === MatchPhase.Finished) return { ok: false, error: 'Match is finished.' }

  if (state.phase === MatchPhase.AwaitingCoupFourre) {
    if (move.kind !== MoveKind.CoupFourre) return { ok: false, error: 'Waiting for Coup Fourré response.' }
    const pending = state.pending!
    if (move.playerIndex !== pending.targetIndex) return { ok: false, error: 'Not your Coup Fourré.' }
    const me = state.players[move.playerIndex]!
    if (me.hand[move.handIndex] !== move.card) return { ok: false, error: 'Safety not in hand.' }
    if (!safetyBlocksHazard(move.card, pending.hazard)) return { ok: false, error: 'Wrong safety for Coup Fourré.' }

    undoHazard(me, pending.hazard)
    state.discardPile.push(pending.hazard)
    me.hand.splice(move.handIndex, 1)
    playSafety(state, move.playerIndex, move.card, true)
    state.coupFourreCount++
    state.pending = null
    state.phase = MatchPhase.Playing
    state.currentPlayer = move.playerIndex
    drawToHand(state, move.playerIndex)
    state.lastMessage = `${me.displayName} Coup Fourré! ${getCard(move.card).name} counter-thrust!`
    return { ok: true }
  }

  if (move.playerIndex !== state.currentPlayer) return { ok: false, error: 'Not your turn.' }
  const me = state.players[move.playerIndex]!
  if (me.hand[move.handIndex] !== move.card) return { ok: false, error: 'Card not in hand.' }

  if (move.kind === MoveKind.Discard) {
    me.hand.splice(move.handIndex, 1)
    state.discardPile.push(move.card)
    state.lastMessage = `${me.displayName} discarded ${getCard(move.card).name}.`
    endTurn(state)
    return { ok: true }
  }

  if (move.kind !== MoveKind.Play) return { ok: false, error: 'Invalid move.' }
  const def = getCard(move.card)

  if (def.category === CardCategory.Distance) {
    if (!canPlayDistance(state, move.playerIndex, move.card)) {
      return { ok: false, error: !canDrive(me) ? 'Need Drive before miles.' : 'Cannot play that distance.' }
    }
    me.hand.splice(move.handIndex, 1)
    me.miles += def.miles
    if (def.miles === 200) me.miles200Played++
    state.lastMessage = `${me.displayName} drove +${def.miles} (total ${me.miles}).`
    if (me.miles >= state.config.goalMiles) {
      state.winnerIndex = move.playerIndex
      state.phase = MatchPhase.Finished
      state.lastMessage = `${me.displayName} completed the ${state.config.goalMiles}-mile road trip!`
      return { ok: true }
    }
    endTurn(state)
    return { ok: true }
  }

  if (def.category === CardCategory.Remedy) {
    if (!canPlayRemedy(state, move.playerIndex, move.card)) return { ok: false, error: 'Cannot play that remedy now.' }
    me.hand.splice(move.handIndex, 1)
    if (move.card === CardId.EndOfLimit) me.speedPile.push(move.card)
    else me.battlePile.push(move.card)
    state.lastMessage = `${me.displayName} played ${def.name}.`
    endTurn(state)
    return { ok: true }
  }

  if (def.category === CardCategory.Safety) {
    if (hasSafety(me, move.card)) return { ok: false, error: 'Safety already played.' }
    me.hand.splice(move.handIndex, 1)
    playSafety(state, move.playerIndex, move.card, false)
    drawToHand(state, move.playerIndex)
    state.lastMessage = `${me.displayName} activated ${def.name} and takes another turn!`
    return { ok: true }
  }

  if (def.category === CardCategory.Hazard) {
    const target = move.targetPlayerIndex
    if (target < 0 || target === move.playerIndex || target >= state.players.length) {
      return { ok: false, error: 'Pick a valid opponent.' }
    }
    if (!canPlayHazard(state, move.playerIndex, target, move.card)) {
      return { ok: false, error: 'Cannot play that hazard on that driver.' }
    }
    me.hand.splice(move.handIndex, 1)
    const victim = state.players[target]!
    const canCoup = victim.hand.some((c) => safetyBlocksHazard(c, move.card))
    applyHazard(victim, move.card)
    if (canCoup) {
      state.pending = {
        attackerIndex: move.playerIndex,
        targetIndex: target,
        hazard: move.card,
        coupDeadlinePlayer: target,
      }
      state.phase = MatchPhase.AwaitingCoupFourre
      state.lastMessage = `${me.displayName} hit ${victim.displayName} with ${def.name}! Coup Fourré?`
      return { ok: true }
    }
    state.lastMessage = `${me.displayName} hit ${victim.displayName} with ${def.name}.`
    endTurn(state)
    return { ok: true }
  }

  return { ok: false, error: 'Unknown card.' }
}
