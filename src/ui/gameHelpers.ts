import { MatchPhase, MoveKind, CardCategory, CardId, getCard, safetyBlocksHazard } from '../core/cards'
import {
  createMatch,
  tryApply,
  getLegalMoves,
  declineCoupFourre,
  playMove,
  discardMove,
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

const AI_DELAY_MS = 1100

export function startSolo(name: string, aiCount: number, difficulty: AiDifficulty): LocalControllers {
  const names = [name || 'You', ...['Cruise Control', 'Night Owl', 'Road Hog'].slice(0, aiCount)]
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
          (state.phase === MatchPhase.Playing && !state.players[state.currentPlayer]!.isHuman)

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
      if (state.currentPlayer !== 0 && state.phase === MatchPhase.Playing) return
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

  if (state.phase === MatchPhase.AwaitingCoupFourre && state.pending?.targetIndex === localIndex) {
    return 'You were attacked. Press Counter! if you have the matching Safety, or Take the hit.'
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
      return `You are stuck under ${getCard(top).name}. Play ${remedyName} now (it should glow). Then next turns: Drive, then miles.`
    }
    return `You are stuck under ${getCard(top).name}. You need ${remedyName} (or the matching Safety). If you don't have it, discard something and hope to draw it.`
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
  return 'Play a Safety, play a hazard on an opponent (click them first), or discard.'
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
  if (state.phase === MatchPhase.AwaitingCoupFourre && state.pending) {
    const victim = state.players[state.pending.targetIndex]!
    if (state.pending.targetIndex === localIndex) return 'You were attacked — Coup Fourré?'
    return `${victim.displayName} was attacked…`
  }
  if (aiThinking || state.currentPlayer !== localIndex) {
    return `${state.players[state.currentPlayer]!.displayName} is taking a turn`
  }
  return 'YOUR TURN'
}

export { playMove, discardMove, getLegalMoves, getCard, MatchPhase, MoveKind }
