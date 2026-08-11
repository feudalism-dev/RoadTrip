import { MatchPhase, MoveKind, CardCategory, getCard, type CardId } from '../core/cards'
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
  return top ? getCard(top as CardId).name : 'empty (need Drive)'
}

export function driveStatus(state: MatchState, i: number): string {
  const p = state.players[i]!
  if (canDrive(p)) return 'Can play miles'
  return 'Stopped — need Drive / clear hazard'
}

export function speedStatus(state: MatchState, i: number): string {
  return speedLimitActive(state.players[i]!) ? 'Speed limited (25/50 only)' : 'No speed limit'
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
