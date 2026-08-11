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
  submit: (move: GameMove) => void
  declineCoup: () => void
}

export function startSolo(name: string, aiCount: number, difficulty: AiDifficulty): LocalControllers {
  const names = [name || 'You', ...['Cruise Control', 'Night Owl', 'Road Hog'].slice(0, aiCount)]
  const humans = names.map((_, i) => i === 0)
  let state = createMatch(names, humans)

  const pumpAi = () => {
    let guard = 0
    while (state.phase !== MatchPhase.Finished && guard++ < 64) {
      if (state.phase === MatchPhase.AwaitingCoupFourre && state.pending) {
        const t = state.pending.targetIndex
        if (state.players[t]!.isHuman) return
        const move = chooseAiMove(state, t, difficulty)
        if (move) tryApply(state, move)
        else declineCoupFourre(state)
        continue
      }
      const cur = state.currentPlayer
      if (state.players[cur]!.isHuman) return
      const move = chooseAiMove(state, cur, difficulty)
      if (!move) return
      tryApply(state, move)
    }
  }

  pumpAi()

  return {
    get state() {
      return state
    },
    localIndex: 0,
    submit(move) {
      const res = tryApply(state, move)
      if (!res.ok) {
        state = { ...state, lastMessage: res.error }
        return
      }
      pumpAi()
    },
    declineCoup() {
      declineCoupFourre(state)
      pumpAi()
    },
  }
}

export function isLegalPlay(state: MatchState, localIndex: number, handIndex: number): boolean {
  if (state.currentPlayer !== localIndex || state.phase !== MatchPhase.Playing) return false
  return getLegalMoves(state).some(
    (m) => m.playerIndex === localIndex && m.handIndex === handIndex && m.kind === MoveKind.Play,
  )
}

export function statusLine(state: MatchState): string {
  return state.lastMessage
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
  return top ? getCard(top as CardId).shortName : '—'
}

export function driveStatus(state: MatchState, i: number): string {
  const p = state.players[i]!
  if (canDrive(p)) return 'GREEN — miles OK'
  return 'RED — need Drive'
}

export function speedStatus(state: MatchState, i: number): string {
  return speedLimitActive(state.players[i]!) ? 'LIMIT (25/50)' : 'OPEN'
}

export { playMove, discardMove, getLegalMoves, getCard, MatchPhase, MoveKind }
