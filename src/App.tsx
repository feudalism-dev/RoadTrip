import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import './styles/tabletop.css'
import {
  startSolo,
  isLegalPlay,
  playMove,
  discardMove,
  getLegalMoves,
  getCard,
  MatchPhase,
  MoveKind,
} from './ui/gameHelpers'
import type { LocalControllers } from './ui/gameHelpers'
import type { AiDifficulty } from './ai/heuristic'
import { createPeerHost, joinPeerRoom, type PeerSession } from './net/peerSession'
import { CardCategory } from './core/cards'
import type { MatchState } from './core/rules'
import { GameBoard } from './ui/GameBoard'
import { ToastManager, useToasts } from './ui/ToastManager'

type Screen = 'menu' | 'soloSetup' | 'lobby' | 'game' | 'help'

export default function App() {
  return (
    <ToastManager>
      <AppInner />
    </ToastManager>
  )
}

function AppInner() {
  const { push } = useToasts()
  const [screen, setScreen] = useState<Screen>('menu')
  const [name, setName] = useState('You')
  const [aiCount, setAiCount] = useState(1)
  const [difficulty, setDifficulty] = useState<AiDifficulty>('normal')
  const [roomInput, setRoomInput] = useState('')
  const [local, setLocal] = useState<LocalControllers | null>(null)
  const [peer, setPeer] = useState<PeerSession | null>(null)
  const [tick, setTick] = useState(0)
  const [selected, setSelected] = useState(-1)
  const [target, setTarget] = useState(-1)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const lastToast = useRef('')

  useEffect(() => {
    if (!peer) return
    return peer.onChange(() => setTick((t) => t + 1))
  }, [peer])

  useEffect(() => {
    if (!local) return
    return local.onChange(() => setTick((t) => t + 1))
  }, [local])

  const state: MatchState | null = local?.state ?? peer?.state ?? null
  const localIndex = local?.localIndex ?? peer?.localIndex ?? 0
  const aiThinking = local?.aiThinking ?? false
  const actionLog = local?.log ?? (state ? [state.lastMessage] : [])

  const bump = () => setTick((t) => t + 1)

  useEffect(() => {
    if (peer?.state && screen === 'lobby') setScreen('game')
  }, [peer?.state, screen, tick])

  useEffect(() => {
    if (!state?.lastMessage) return
    setStatus(state.lastMessage)
    if (state.lastMessage !== lastToast.current) {
      lastToast.current = state.lastMessage
      push(state.lastMessage)
    }
  }, [state?.lastMessage, tick, push])

  const legalIndexes = useMemo(() => {
    if (!state) return new Set<number>()
    const set = new Set<number>()
    for (const m of getLegalMoves(state)) {
      if (m.playerIndex === localIndex && m.kind === MoveKind.Play) set.add(m.handIndex)
    }
    state.players[localIndex]!.hand.forEach((_, i) => {
      if (isLegalPlay(state, localIndex, i)) set.add(i)
    })
    return set
  }, [state, localIndex, tick])

  const playIndex = (handIndex: number) => {
    if (!state || aiThinking) return
    const card = state.players[localIndex]!.hand[handIndex]
    if (card === undefined) return
    const def = getCard(card)
    let t = -1
    if (def.category === CardCategory.Hazard) {
      if (target < 0 || target === localIndex) {
        push('Click an opponent tableau first, then play the hazard.')
        setSelected(handIndex)
        return
      }
      t = target
    }
    if (!legalIndexes.has(handIndex) && !isLegalPlay(state, localIndex, handIndex)) {
      push('That card is not playable right now.')
      return
    }
    local?.submit(playMove(localIndex, handIndex, card, t))
    peer?.submit(playMove(localIndex, handIndex, card, t))
    setSelected(-1)
    bump()
  }

  const discardIndex = (handIndex: number) => {
    if (!state || aiThinking) return
    const card = state.players[localIndex]!.hand[handIndex]
    if (card === undefined) return
    local?.submit(discardMove(localIndex, handIndex, card))
    peer?.submit(discardMove(localIndex, handIndex, card))
    setSelected(-1)
    bump()
  }

  const startLocal = () => {
    local?.destroy()
    const ctrl = startSolo(name, aiCount, difficulty)
    setLocal(ctrl)
    setPeer(null)
    setSelected(-1)
    setTarget(-1)
    setScreen('game')
    setStatus(ctrl.state.lastMessage)
    push(ctrl.state.lastMessage)
  }

  const leaveToMenu = () => {
    peer?.destroy()
    local?.destroy()
    setPeer(null)
    setLocal(null)
    setScreen('menu')
  }

  if (screen === 'menu') {
    return (
      <div className="shell-menu">
        <div className="menu-card">
          <h1>ROAD TRIP</h1>
          <p>
            A modern night-drive take on Mille Bornes.
            <br />
            Race exactly 1,000 miles across the table.
          </p>
          <button className="btn primary" onClick={() => setScreen('soloSetup')}>
            Play Solo vs AI
          </button>
          <button className="btn secondary" onClick={() => setScreen('lobby')}>
            Multiplayer Lobby
          </button>
          <button className="btn ghost" onClick={() => setScreen('help')}>
            How to Play
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'help') {
    return (
      <div className="shell-menu">
        <div className="menu-card wide">
          <h2>How to Play</h2>
          <ol className="help-list">
            <li>
              Play <strong>Drive</strong> so you are moving.
            </li>
            <li>
              Play green <strong>mile cards</strong> toward exactly 1000.
            </li>
            <li>Opponents hit you with red hazards — clear them with matching remedies/safeties.</li>
            <li>On your turn: double-click a lit card to play, or drag it up onto the table.</li>
            <li>Drag a card down to discard.</li>
          </ol>
          <button className="btn secondary" onClick={() => setScreen('menu')}>
            Back
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'soloSetup') {
    return (
      <div className="shell-menu">
        <div className="menu-card">
          <h2>Solo Road Trip</h2>
          <label>
            Driver name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            AI opponents
            <select value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
          <label>
            Difficulty
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as AiDifficulty)}>
              <option value="easy">Easy</option>
              <option value="normal">Normal</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <button className="btn primary" onClick={startLocal}>
            Start Race
          </button>
          <button className="btn ghost" onClick={() => setScreen('menu')}>
            Back
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'lobby' && !state) {
    return (
      <div className="shell-menu">
        <div className="menu-card">
          <h2>Multiplayer Lobby</h2>
          <label>
            Driver name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Room code
            <input
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
              placeholder="ABCDE"
            />
          </label>
          <button
            className="btn primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                peer?.destroy()
                local?.destroy()
                const session = await createPeerHost(name)
                setPeer(session)
                setLocal(null)
                setStatus(session.status)
                setScreen('lobby')
              } catch (e) {
                setStatus(e instanceof Error ? e.message : 'Create failed')
              } finally {
                setBusy(false)
              }
            }}
          >
            Create Room
          </button>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                peer?.destroy()
                local?.destroy()
                const session = await joinPeerRoom(roomInput.trim(), name)
                setPeer(session)
                setLocal(null)
                setStatus(session.status)
                setScreen('lobby')
              } catch (e) {
                setStatus(e instanceof Error ? e.message : 'Join failed')
              } finally {
                setBusy(false)
              }
            }}
          >
            Join Room
          </button>
          {peer && (
            <>
              <p>
                Room <strong>{peer.roomCode}</strong>
              </p>
              <ul>
                {peer.seats.map((s) => (
                  <li key={s.id}>
                    {s.isHost ? '[Host] ' : ''}
                    {s.name}
                    {s.ready ? ' ✓' : ''}
                  </li>
                ))}
              </ul>
              <button className="btn secondary" onClick={() => peer.setReady(true)}>
                Ready
              </button>
              {peer.isHost && (
                <button
                  className="btn primary"
                  onClick={() => {
                    peer.startMatch()
                    bump()
                  }}
                >
                  Start Match
                </button>
              )}
            </>
          )}
          {status && <p className="muted">{status}</p>}
          <button className="btn ghost" onClick={leaveToMenu}>
            Back
          </button>
        </div>
      </div>
    )
  }

  if (!state) return null

  const myTurn = state.currentPlayer === localIndex && state.phase === MatchPhase.Playing && !aiThinking
  const myCoup = state.phase === MatchPhase.AwaitingCoupFourre && state.pending?.targetIndex === localIndex

  let coupBanner: ReactNode = null
  if (myCoup) {
    coupBanner = (
      <div className="banner-overlay">
        <div className="banner-card">
          <h2>You were attacked!</h2>
          <p>Play your matching Safety for a Coup Fourré, or take the hit.</p>
          <button
            className="btn primary"
            onClick={() => {
              const move = getLegalMoves(state).find((m) => m.kind === MoveKind.CoupFourre)
              if (move) {
                local?.submit(move)
                peer?.submit(move)
                bump()
              }
            }}
          >
            Counter! (Coup Fourré)
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              local?.declineCoup()
              peer?.declineCoup()
              bump()
            }}
          >
            Take the hit
          </button>
        </div>
      </div>
    )
  }

  let endOverlay: ReactNode = null
  if (state.phase === MatchPhase.Finished) {
    endOverlay = (
      <div className="banner-overlay">
        <div className="banner-card">
          <h2>{state.winnerIndex >= 0 ? state.players[state.winnerIndex]!.displayName : 'Nobody'}</h2>
          <p>{state.lastMessage}</p>
          <button className="btn primary" onClick={leaveToMenu}>
            Main Menu
          </button>
        </div>
      </div>
    )
  }

  return (
    <GameBoard
      state={state}
      localIndex={localIndex}
      log={actionLog}
      legalIndexes={legalIndexes}
      selected={selected}
      target={target}
      myTurn={myTurn}
      aiThinking={aiThinking}
      onSelectCard={setSelected}
      onPlayIndex={playIndex}
      onDiscardIndex={discardIndex}
      onSelectTarget={setTarget}
      onMenu={leaveToMenu}
      coupBanner={coupBanner}
      endOverlay={endOverlay}
    />
  )
}
