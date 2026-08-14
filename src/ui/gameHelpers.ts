import { MatchPhase, MoveKind, CardCategory, CardId, getCard, safetyBlocksHazard, MAX_PLAYERS } from '../core/cards'
import {
  createMatch,
  tryApply,
  getLegalMoves,
  declineCoupFourre,
  playMove,
  discardMove,
  drawDeckMove,
  drawDiscardMove,
  autoClubAcceptMove,
  autoClubDeclineMove,
  type MatchState,
  type GameMove,
} from '../core/rules'
import { chooseAiMove, type AiDifficulty } from '../ai/heuristic'
import { battleTop, speedLimitActive, canDrive } from '../core/state'

export type LocalControllers = {
  state: MatchState
  localIndex: number
  log: string[]
  aiThinking: boolean
  submit: (move: GameMove) => void
  declineCoup: () => void
  onChange: (cb: () => void) => () => void
  destroy: () => void
}

const AI_DELAY_MS = 2800
/** Keep in sync with RoadTrip_Track.lsl cpuNameForIndex (Furware CPU labels). */
const AI_NAMES = ['Cruise Control', 'Postcard', 'Road Hog'] as const

export function startSolo(name: string, aiCount: number, difficulty: AiDifficulty): LocalControllers {
  const cappedAi = Math.max(1, Math.min(aiCount, MAX_PLAYERS - 1))
  const names = [name || 'You', ...AI_NAMES.slice(0, cappedAi)]
  const humans = names.map((_, i) => i === 0)
  let state = createMatch(names, humans)
  const log: string[] = [state.lastMessage]
  let aiThinking = false
  let cancelled = false
  let running = false
  const listeners = new Set<() => void>()

  const notify = () => listeners.forEach((l) => l())

  const pushLog = (msg: string) => {
    log.unshift(msg)
    if (log.length > 12) log.length = 12
  }

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

  const stepAiOnce = (): boolean => {
    if (state.phase === MatchPhase.Finished) return false

    if (state.phase === MatchPhase.AwaitingCoupFourre && state.pending) {
      const t = state.pending.targetIndex
      if (state.players[t]!.isHuman) return false
      const move = chooseAiMove(state, t, difficulty)
      if (move) tryApply(state, move)
      else declineCoupFourre(state)
      pushLog(state.lastMessage)
      return true
    }

    if (state.phase === MatchPhase.AwaitingAutoClub && state.pendingAutoClub) {
      const t = state.pendingAutoClub.playerIndex
      if (state.players[t]!.isHuman) return false
      const move = chooseAiMove(state, t, difficulty)
      if (move) tryApply(state, move)
      pushLog(state.lastMessage)
      return true
    }

    const cur = state.currentPlayer
    if (state.players[cur]!.isHuman) return false
    const move = chooseAiMove(state, cur, difficulty)
    if (!move) {
      pushLog(`${state.players[cur]!.displayName} has no moves.`)
      return false
    }
    tryApply(state, move)
    pushLog(state.lastMessage)
    return true
  }

  const pumpAi = async () => {
    if (running || cancelled) return
    running = true
    try {
      let guard = 0
      while (!cancelled && state.phase !== MatchPhase.Finished && guard++ < 64) {
        const needAi =
          (state.phase === MatchPhase.AwaitingCoupFourre &&
            state.pending &&
            !state.players[state.pending.targetIndex]!.isHuman) ||
          (state.phase === MatchPhase.AwaitingAutoClub &&
            state.pendingAutoClub &&
            !state.players[state.pendingAutoClub.playerIndex]!.isHuman) ||
          ((state.phase === MatchPhase.Playing || state.phase === MatchPhase.AwaitingDraw) &&
            !state.players[state.currentPlayer]!.isHuman)

        if (!needAi) {
          aiThinking = false
          notify()
          return
        }

        aiThinking = true
        notify()
        await sleep(AI_DELAY_MS)
        if (cancelled) return
        stepAiOnce()
        notify()
      }
    } finally {
      aiThinking = false
      running = false
      notify()
    }
  }

  // Opening: if AI somehow starts first (shouldn't), still pump.
  void pumpAi()

  return {
    get state() {
      return state
    },
    localIndex: 0,
    get log() {
      return log
    },
    get aiThinking() {
      return aiThinking
    },
    submit(move) {
      if (aiThinking) return
      const cur = state.currentPlayer
      const myPhase =
        state.phase === MatchPhase.Playing ||
        state.phase === MatchPhase.AwaitingDraw ||
        (state.phase === MatchPhase.AwaitingCoupFourre && state.pending?.targetIndex === 0) ||
        (state.phase === MatchPhase.AwaitingAutoClub && state.pendingAutoClub?.playerIndex === 0)
      if (cur !== 0 && state.phase !== MatchPhase.AwaitingCoupFourre && state.phase !== MatchPhase.AwaitingAutoClub) {
        return
      }
      if (!myPhase) return
      const res = tryApply(state, move)
      if (!res.ok) {
        state = { ...state, lastMessage: res.error }
        pushLog(res.error)
        notify()
        return
      }
      pushLog(state.lastMessage)
      notify()
      void pumpAi()
    },
    declineCoup() {
      if (aiThinking) return
      declineCoupFourre(state)
      pushLog(state.lastMessage)
      notify()
      void pumpAi()
    },
    onChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    destroy() {
      cancelled = true
      listeners.clear()
    },
  }
}

export function isLegalPlay(state: MatchState, localIndex: number, handIndex: number): boolean {
  if (state.currentPlayer !== localIndex || state.phase !== MatchPhase.Playing) return false
  return getLegalMoves(state).some(
    (m) => m.playerIndex === localIndex && m.handIndex === handIndex && m.kind === MoveKind.Play,
  )
}

/** Hit-test opponent/self tableaux marked with `data-rt-player`. */
export function playerIndexAtPoint(clientX: number, clientY: number): number | null {
  const el = document.elementFromPoint(clientX, clientY)
  if (!el) return null
  const node = el.closest('[data-rt-player]')
  if (!node) return null
  const raw = node.getAttribute('data-rt-player')
  if (raw == null || raw === '') return null
  const idx = Number(raw)
  return Number.isFinite(idx) ? idx : null
}

export function cardClass(category: CardCategory): string {
  switch (category) {
    case CardCategory.Distance:
      return 'card distance'
    case CardCategory.Hazard:
      return 'card hazard'
    case CardCategory.Remedy:
      return 'card remedy'
    case CardCategory.Safety:
      return 'card safety'
    default:
      return 'card'
  }
}

export function formatBattle(state: MatchState, i: number): string {
  const p = state.players[i]!
  const top = battleTop(p)
  return top ? getCard(top).name : 'empty'
}

export function driveStatus(state: MatchState, i: number): string {
  const p = state.players[i]!
  if (canDrive(p)) return 'Moving — you may play mile cards'
  return 'Stopped — cannot play mile cards yet'
}

export function speedStatus(state: MatchState, i: number): string {
  return speedLimitActive(state.players[i]!) ? 'Speed limited (only 25 or 50)' : 'No speed limit'
}

/** Plain-English coaching for the human player. */
export function whatShouldIDo(state: MatchState, localIndex: number): string {
  const me = state.players[localIndex]!
  const top = battleTop(me)

  if (state.phase === MatchPhase.Finished) return 'The race is over.'

  if (state.phase === MatchPhase.AwaitingDraw && state.currentPlayer === localIndex) {
    return 'Tap Draw deck or Take discard to take a card.'
  }

  if (state.phase === MatchPhase.AwaitingCoupFourre && state.pending?.targetIndex === localIndex) {
    return 'You were attacked. Press Counter Attack if you have the matching Safety, or Take the hit.'
  }

  if (state.phase === MatchPhase.AwaitingAutoClub && state.pendingAutoClub?.playerIndex === localIndex) {
    const cost = state.pendingAutoClub.cost
    return `Call the Auto Club? Lose ${cost} miles to get towed and back on the road, or wait for a fix.`
  }

  if (state.currentPlayer !== localIndex) {
    return `Wait — ${state.players[state.currentPlayer]!.displayName} is playing right now.`
  }

  // Hazard on battle pile
  if (top && getCard(top).category === CardCategory.Hazard && getCard(top).isBattleHazard) {
    const remedyName = remedyNameFor(top)
    const hasRemedy = me.hand.some((c) => getCard(c).countersHazard === top || (top === CardId.RedLight && c === CardId.Drive))
    const hasSafety = me.hand.some((c) => safetyBlocksHazard(c, top))
    if (hasSafety) {
      return `You are stuck under ${getCard(top).name}. Best: play the matching Safety (glowing), or play ${remedyName}.`
    }
    if (hasRemedy) {
      return `You are stuck under ${getCard(top).name}. Play ${remedyName} now (it should glow) — that restores GO so you can play miles again.`
    }
    const nextClub =
      me.stuckTurns >= 15 ? 'a free Highway Patrol tow at 20' : me.stuckTurns >= 10 ? 'a 25-mile tow at 15' : me.stuckTurns >= 5 ? 'a 50-mile tow at 10' : 'Auto Club after 5 of your stuck turns'
    return `You are stuck under ${getCard(top).name}. You need ${remedyName} (or the matching Safety). If you don't have it, discard something and hope to draw it (${me.stuckTurns} stuck turn${me.stuckTurns === 1 ? '' : 's'}; ${nextClub}).`
  }

  // Empty or non-drive remedy showing — need Drive
  if (!canDrive(me)) {
    const hasDrive = me.hand.includes(CardId.Drive)
    if (hasDrive) return 'Play Drive (GO) so you can start adding miles next.'
    return 'You need a Drive (GO) card before miles. Discard something else, or play a Safety if you have one.'
  }

  // Can drive
  const mile = me.hand.find((c) => getCard(c).category === CardCategory.Distance && me.miles + getCard(c).miles <= state.config.goalMiles)
  if (mile) {
    return `You're moving. Play a mile card (glowing), or hit Cruise Control with a hazard if you want to slow them down.`
  }
  return 'Play a Safety, slide a hazard onto an opponent, or discard.'
}

function remedyNameFor(hazard: CardId): string {
  switch (hazard) {
    case CardId.RedLight:
      return 'Drive'
    case CardId.Accident:
      return 'Repairs'
    case CardId.OutOfGas:
      return 'Gasoline'
    case CardId.FlatTire:
      return 'Spare Tire'
    case CardId.TrafficJam:
      return 'Traffic Clear'
    case CardId.GpsError:
      return 'Navigation Fix'
    default:
      return 'the matching remedy'
  }
}

export function turnBanner(state: MatchState, localIndex: number, aiThinking: boolean): string {
  if (state.phase === MatchPhase.Finished) return 'Finished'
  if (state.phase === MatchPhase.AwaitingDraw) {
    if (state.currentPlayer === localIndex) return 'YOUR DRAW — double-click a pile'
    return `${state.players[state.currentPlayer]!.displayName} is drawing…`
  }
  if (state.phase === MatchPhase.AwaitingCoupFourre && state.pending) {
    const victim = state.players[state.pending.targetIndex]!
    if (state.pending.targetIndex === localIndex) return 'You were attacked — Counter Attack?'
    return `${victim.displayName} was attacked…`
  }
  if (state.phase === MatchPhase.AwaitingAutoClub && state.pendingAutoClub) {
    const who = state.players[state.pendingAutoClub.playerIndex]!
    if (state.pendingAutoClub.playerIndex === localIndex) return 'Auto Club — call a tow?'
    return `${who.displayName} is deciding on a tow…`
  }
  if (aiThinking || state.currentPlayer !== localIndex) {
    return `${state.players[state.currentPlayer]!.displayName} is taking a turn`
  }
  return 'YOUR TURN'
}

export {
  playMove,
  discardMove,
  drawDeckMove,
  drawDiscardMove,
  autoClubAcceptMove,
  autoClubDeclineMove,
  getLegalMoves,
  getCard,
  MatchPhase,
  MoveKind,
}
