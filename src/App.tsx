import { useEffect, useMemo, useState } from 'react'
import './styles/app.css'
import {
  startSolo,
  isLegalPlay,
  cardClass,
  formatBattle,
  driveStatus,
  speedStatus,
  turnBanner,
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

type Screen = 'menu' | 'soloSetup' | 'lobby' | 'game' | 'help'

export default function App() {
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

  const startLocal = () => {
    local?.destroy()
    const ctrl = startSolo(name, aiCount, difficulty)
    setLocal(ctrl)
    setPeer(null)
    setSelected(-1)
    setTarget(-1)
    setScreen('game')
    setStatus(ctrl.state.lastMessage)
  }

  const createRoom = async () => {
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
      setStatus(e instanceof Error ? e.message : 'Could not create room')
    } finally {
      setBusy(false)
    }
  }

  const joinRoom = async () => {
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
      setStatus(e instanceof Error ? e.message : 'Could not join room')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (peer?.state && screen === 'lobby') setScreen('game')
  }, [peer?.state, screen, tick])

  useEffect(() => {
    if (state) setStatus(state.lastMessage)
  }, [state?.lastMessage, tick])

  const legalSet = useMemo(() => {
    if (!state) return new Set<number>()
    const set = new Set<number>()
    for (const m of getLegalMoves(state)) {
      if (m.playerIndex === localIndex && m.kind === MoveKind.Play) set.add(m.handIndex)
    }
    return set
  }, [state, localIndex, tick])

  const submitPlay = () => {
    if (!state || selected < 0 || aiThinking) return
    const card = state.players[localIndex]!.hand[selected]!
    const def = getCard(card)
    let t = -1
    if (def.category === CardCategory.Hazard) {
      if (target < 0 || target === localIndex) {
        setStatus('First click an opponent card area, then Play.')
        return
      }
      t = target
    }
    local?.submit(playMove(localIndex, selected, card, t))
    peer?.submit(playMove(localIndex, selected, card, t))
    setSelected(-1)
    bump()
  }

  const submitDiscard = () => {
    if (!state || selected < 0 || aiThinking) return
    const card = state.players[localIndex]!.hand[selected]!
    local?.submit(discardMove(localIndex, selected, card))
    peer?.submit(discardMove(localIndex, selected, card))
    setSelected(-1)
    bump()
  }

  const doCoup = () => {
    if (!state || aiThinking) return
    const move = getLegalMoves(state).find((m) => m.kind === MoveKind.CoupFourre)
    if (move) {
      local?.submit(move)
      peer?.submit(move)
      bump()
    }
  }

  if (screen === 'menu') {
    return (
      <div className="app">
        <div className="panel menu">
          <h1 className="brand">ROAD TRIP</h1>
          <p className="tag">A modern night-drive take on Mille Bornes.<br />Race exactly 1,000 miles.</p>
          <div className="stack">
            <button className="btn cyan" onClick={() => setScreen('soloSetup')}>Play Solo vs AI</button>
            <button className="btn amber" onClick={() => setScreen('lobby')}>Multiplayer Lobby</button>
            <button className="btn ghost" onClick={() => setScreen('help')}>How to Play</button>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'help') {
    return (
      <div className="app">
        <div className="panel menu" style={{ maxWidth: 680, textAlign: 'left' }}>
          <h2 className="brand" style={{ fontSize: '2rem' }}>How to Play</h2>
          <p className="help">{`Think of it like a race board:

1. Play a green DRIVE card so you are "moving".
2. Play MILE cards (25/50/75/100/200) to add distance.
3. First to exactly 1000 wins (can't go over).

Opponents will:
• Play hazards on YOU to stop your car
• Drive their own miles when they can
• Play safeties for permanent protection

On YOUR turn you only do ONE thing:
• Play one card, OR discard one card

If you are stopped (red status), play the matching remedy,
then Drive again before more miles.

Glowing cards = legal plays right now.
Yellow "TURN" on a player = it is their turn.
Watch the Action Log to see what everyone just did.`}</p>
          <button className="btn amber" onClick={() => setScreen('menu')}>Back</button>
        </div>
      </div>
    )
  }

  if (screen === 'soloSetup') {
    return (
      <div className="app">
        <div className="panel menu">
          <h2 className="brand" style={{ fontSize: '2rem' }}>Solo Road Trip</h2>
          <div className="stack">
            <label className="field">Driver name
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">AI opponents
              <select value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))}>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
            <label className="field">Difficulty
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as AiDifficulty)}>
                <option value="easy">Easy</option>
                <option value="normal">Normal</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <button className="btn green" onClick={startLocal}>Start Race</button>
            <button className="btn ghost" onClick={() => setScreen('menu')}>Back</button>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'lobby' && !state) {
    return (
      <div className="app">
        <div className="panel menu" style={{ maxWidth: 560 }}>
          <h2 className="brand" style={{ fontSize: '2rem' }}>Multiplayer Lobby</h2>
          <p className="tag">Peer-to-peer rooms (free). Share the room code with friends.</p>
          <div className="stack">
            <label className="field">Driver name
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">Room code
              <input value={roomInput} onChange={(e) => setRoomInput(e.target.value.toUpperCase())} placeholder="ABCDE" />
            </label>
            <button className="btn cyan" disabled={busy} onClick={createRoom}>Create Room</button>
            <button className="btn amber" disabled={busy} onClick={joinRoom}>Join Room</button>
            {peer && (
              <>
                <p className="muted">Room <strong>{peer.roomCode}</strong></p>
                <ul className="muted" style={{ textAlign: 'left' }}>
                  {peer.seats.map((s) => (
                    <li key={s.id}>{s.isHost ? '[Host] ' : ''}{s.name}{s.ready ? ' ✓' : ' …'}</li>
                  ))}
                </ul>
                <button className="btn green" onClick={() => peer.setReady(true)}>Ready</button>
                {peer.isHost && <button className="btn cyan" onClick={() => { peer.startMatch(); bump() }}>Start Match</button>}
              </>
            )}
            {status && <p className="muted">{status}</p>}
            <button className="btn ghost" onClick={() => { peer?.destroy(); setPeer(null); setScreen('menu') }}>Back</button>
          </div>
        </div>
      </div>
    )
  }

  if (!state) return null

  const me = state.players[localIndex]!
  const myTurn = state.currentPlayer === localIndex && state.phase === MatchPhase.Playing && !aiThinking
  const myCoup =
    state.phase === MatchPhase.AwaitingCoupFourre &&
    state.pending?.targetIndex === localIndex
  const banner = turnBanner(state, localIndex, aiThinking)

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand" style={{ fontSize: '1.4rem', margin: 0 }}>ROAD TRIP</div>
        <button
          className="btn ghost"
          onClick={() => {
            peer?.destroy()
            local?.destroy()
            setPeer(null)
            setLocal(null)
            setScreen('menu')
          }}
        >
          Menu
        </button>
      </div>

      <div className={`turn-banner ${myTurn ? 'yours' : 'theirs'}`}>
        {banner}
        {!myTurn && !myCoup && state.phase !== MatchPhase.Finished && (
          <span className="turn-sub">Watch the Action Log — each opponent play appears there.</span>
        )}
        {myTurn && (
          <span className="turn-sub">Select a glowing card, then Play or Discard. One action only.</span>
        )}
      </div>

      <div className="route">
        {state.players.map((p, i) => {
          const pct = Math.min(100, (p.miles / state.config.goalMiles) * 100)
          return (
            <div
              key={i}
              className={`car ${state.currentPlayer === i ? 'active-car' : ''}`}
              style={{
                left: `calc(${pct}% - 27px)`,
                top: 12 + i * 14,
                background: i === localIndex ? 'var(--cyan)' : 'var(--amber)',
              }}
              title={p.displayName}
            >
              {p.miles}
            </div>
          )
        })}
        <div className="route-label">NIGHT HIGHWAY · 0 ──────── 1000</div>
      </div>

      <div className="opponents">
        {state.players.map((p, i) => {
          if (i === localIndex) return null
          const theirTurn = state.currentPlayer === i
          return (
            <button
              key={i}
              className={`seat ${target === i ? 'selected' : ''} ${theirTurn ? 'turn' : ''}`}
              onClick={() => setTarget(i)}
            >
              {theirTurn && <div className="turn-pill">THEIR TURN</div>}
              <strong>{p.displayName}</strong>
              <div>{p.miles} mi</div>
              <div>Battle: {formatBattle(state, i)}</div>
              <div>{speedStatus(state, i)}</div>
              <div className="muted">{p.safeties.map((s) => getCard(s).shortName).join(', ') || 'no safeties'}</div>
            </button>
          )
        })}
      </div>

      <div className="grid-2">
        <div className="panel tableau">
          <div><strong>You</strong> · {me.miles} / {state.config.goalMiles} miles</div>
          <div>Battle pile: {formatBattle(state, localIndex)}</div>
          <div>{driveStatus(state, localIndex)}</div>
          <div>{speedStatus(state, localIndex)}</div>
          <div>Safeties: {me.safeties.map((s) => getCard(s).shortName).join(', ') || 'None yet'}</div>
          <div className="muted">Deck {state.drawPile.length} · Discard {state.discardPile.length}</div>
          {target >= 0 && target !== localIndex && (
            <div className="hint">Hazard target: {state.players[target]!.displayName}</div>
          )}
        </div>

        <div className="panel log-panel">
          <strong>Action Log</strong>
          <ol className="log">
            {actionLog.map((line, i) => (
              <li key={`${i}-${line.slice(0, 24)}`} className={i === 0 ? 'latest' : ''}>{line}</li>
            ))}
          </ol>
        </div>
      </div>

      <div className="actions-row">
        <button className="btn green" disabled={!myTurn || selected < 0} onClick={submitPlay}>Play selected</button>
        <button className="btn red" disabled={!myTurn || selected < 0} onClick={submitDiscard}>Discard selected</button>
      </div>

      <div className="hand">
        {me.hand.map((card, i) => {
          const def = getCard(card)
          const legal = myTurn && (legalSet.has(i) || isLegalPlay(state, localIndex, i))
          return (
            <button
              key={`${card}-${i}-${tick}`}
              className={`${cardClass(def.category)}${legal ? ' legal' : ''}${selected === i ? ' selected' : ''}`}
              onClick={() => !aiThinking && setSelected(i)}
              disabled={aiThinking}
            >
              <span className="title">{def.shortName}</span>
              <span className="meta">{def.name}</span>
            </button>
          )
        })}
      </div>

      {myCoup && (
        <div className="banner">
          <div className="panel">
            <h2>You were hit!</h2>
            <p className="muted">You hold the matching Safety — Coup Fourré cancels the attack and gives you the turn.</p>
            <div className="stack">
              <button className="btn green" onClick={doCoup}>Counter! (Coup Fourré)</button>
              <button className="btn ghost" onClick={() => { local?.declineCoup(); peer?.declineCoup(); bump() }}>Take the hit</button>
            </div>
          </div>
        </div>
      )}

      {state.phase === MatchPhase.Finished && (
        <div className="overlay">
          <div className="panel">
            <h2 className="brand" style={{ fontSize: '2rem' }}>
              {state.winnerIndex >= 0 ? state.players[state.winnerIndex]!.displayName : 'Nobody'}
            </h2>
            <p>{state.lastMessage}</p>
            <button className="btn cyan" onClick={() => { peer?.destroy(); local?.destroy(); setPeer(null); setLocal(null); setScreen('menu') }}>
              Main Menu
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
