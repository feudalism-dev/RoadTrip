import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import './styles/tabletop.css'
import {
  startSolo,
  isLegalPlay,
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
} from './ui/gameHelpers'
import type { LocalControllers } from './ui/gameHelpers'
import type { AiDifficulty } from './ai/heuristic'
import { createPeerHost, joinPeerRoom, type PeerSession } from './net/peerSession'
import { CardCategory } from './core/cards'
import type { MatchState } from './core/rules'
import { GameBoard } from './ui/GameBoard'
import { ToastManager, useToasts } from './ui/ToastManager'
import { readSlBootstrap } from './sl/bootstrap'
import { tableEndGame } from './sl/tableApi'
import { emitFromState, buildWireMap } from './sl/trackEvents'
import { cloneState } from './core/state'
import { SlTableScreens } from './ui/SlTableScreens'
import type { TableStatus } from './sl/tableApi'
import { AppChrome } from './ui/AppChrome'
import { ParkedHud } from './ui/ParkedHud'
import { assets } from './ui/assets'
import { FinishOverlay } from './ui/FinishOverlay'
import { HowToPlay } from './ui/HowToPlay'

type Screen = 'menu' | 'soloSetup' | 'lobby' | 'game' | 'help' | 'sl'

export default function App() {
  return (
    <ToastManager>
      <AppInner />
    </ToastManager>
  )
}

function AppInner() {
  const { push } = useToasts()
  const slBoot = useMemo(() => readSlBootstrap(), [])
  const [screen, setScreen] = useState<Screen>(slBoot ? 'sl' : 'menu')
  const [name, setName] = useState(slBoot?.name || 'You')
  const [aiCount, setAiCount] = useState(1)
  const [difficulty, setDifficulty] = useState<AiDifficulty>('normal')
  const [roomInput, setRoomInput] = useState(slBoot?.room || '')
  const [local, setLocal] = useState<LocalControllers | null>(null)
  const [peer, setPeer] = useState<PeerSession | null>(null)
  const [tick, setTick] = useState(0)
  const [selected, setSelected] = useState(-1)
  const [target, setTarget] = useState(-1)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const lastToast = useRef('')
  const slMatchKind = useRef<'none' | 'solo' | 'mp'>('none')
  const prevMatchRef = useRef<MatchState | null>(null)
  /** Match index → track lane 1–4 (AVsitter seat + 1). */
  const wireByPlayerRef = useRef<number[]>([1])

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

  const wrap = (node: ReactNode) => (
    <div className="app-frame" style={{ '--asset-hero': `url(${assets.menuHero})` } as CSSProperties}>
      <AppChrome
        slBoot={slBoot}
        parked={Boolean(slBoot?.parked)}
        roomCode={peer?.roomCode || slBoot?.room}
        onStatus={(msg) => {
          setStatus(msg)
          push(msg)
        }}
      />
      <div className="app-scale">{node}</div>
    </div>
  )

  // Solo client or PeerJS host → physical track events (guests never emit)
  useEffect(() => {
    if (!state) return
    if (!slBoot?.slCap) return
    const isEmitter = Boolean(local) || peer?.isHost === true
    emitFromState(prevMatchRef.current, state, {
      slCap: slBoot.slCap,
      uid: slBoot.uid,
      localSeat: slBoot.seat,
      isEmitter,
      wireByPlayer: wireByPlayerRef.current,
    })
    prevMatchRef.current = cloneState(state)
  }, [tick, state, local, peer, slBoot])

  useEffect(() => {
    if (!slBoot || slBoot.slCap) return
    if (!state) return
    push('Table link missing (sl_cap) — in-world cars/screens will not move this session.')
  }, [slBoot, state, push])

  useEffect(() => {
    if (peer?.state && (screen === 'lobby' || screen === 'sl')) setScreen('game')
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

  const releaseSlTable = async () => {
    if (!slBoot?.slCap) return
    try {
      await tableEndGame(slBoot.slCap, slBoot.uid, slBoot.seat)
    } catch {
      /* ignore */
    }
  }

  const playIndex = (handIndex: number, opts?: { dropPlayerIndex?: number }) => {
    if (!state || aiThinking) return
    const card = state.players[localIndex]!.hand[handIndex]
    if (card === undefined) return
    const def = getCard(card)
    let t = -1
    if (def.category === CardCategory.Hazard) {
      const drop = opts?.dropPlayerIndex
      if (drop != null && drop !== localIndex) {
        t = drop
        setTarget(drop)
      } else if (target >= 0 && target !== localIndex) {
        t = target
      } else {
        push('Slide the hazard onto an opponent, or click their tableau then double-click the card.')
        setSelected(handIndex)
        return
      }
      const legalForTarget = getLegalMoves(state).some(
        (m) =>
          m.kind === MoveKind.Play &&
          m.playerIndex === localIndex &&
          m.handIndex === handIndex &&
          m.targetPlayerIndex === t,
      )
      if (!legalForTarget) {
        push('Cannot play that hazard on that opponent right now.')
        setSelected(handIndex)
        return
      }
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

  const drawFromDeck = () => {
    if (!state || aiThinking) return
    local?.submit(drawDeckMove(localIndex))
    peer?.submit(drawDeckMove(localIndex))
    bump()
  }

  const drawFromDiscard = () => {
    if (!state || aiThinking) return
    local?.submit(drawDiscardMove(localIndex))
    peer?.submit(drawDiscardMove(localIndex))
    bump()
  }

  const startLocal = async () => {
    local?.destroy()
    peer?.destroy()
    const ctrl = startSolo(name, aiCount, difficulty)
    wireByPlayerRef.current = buildWireMap({
      playerCount: ctrl.state.players.length,
      localMatchIndex: 0,
      localSeat: slBoot?.seat ?? 0,
    })
    prevMatchRef.current = null
    setLocal(ctrl)
    setPeer(null)
    setSelected(-1)
    setTarget(-1)
    slMatchKind.current = 'solo'
    setScreen('game')
    setStatus(ctrl.state.lastMessage)
    push(ctrl.state.lastMessage)
  }

  const leaveToMenu = async () => {
    peer?.destroy()
    local?.destroy()
    setPeer(null)
    setLocal(null)
    prevMatchRef.current = null
    wireByPlayerRef.current = [1]
    if (slBoot && slMatchKind.current !== 'none') {
      await releaseSlTable()
    }
    slMatchKind.current = 'none'
    setScreen(slBoot ? 'sl' : 'menu')
  }

  if (slBoot?.parked) {
    return wrap(<ParkedHud boot={slBoot} />)
  }

  if (slBoot?.action === 'browser' && slBoot.client !== 'browser') {
    return wrap(
      <div className="shell-menu">
        <div className="menu-card">
          <p className="brand-kicker">Second Life</p>
          <h2>Opening your browser</h2>
          <p>
            Confirm the Second Life dialog to play on a real monitor. This HUD will park so you do
            not run two clients for the same seat.
          </p>
        </div>
      </div>,
    )
  }

  if (screen === 'sl' && slBoot && !state) {
    return wrap(
      <SlTableScreens
        boot={slBoot}
        displayName={name}
        onNameChange={setName}
        busy={busy}
        setBusy={setBusy}
        status={status}
        setStatus={setStatus}
        onStartSolo={startLocal}
        aiCount={aiCount}
        onAiCountChange={setAiCount}
        onCreatedMp={async (roomCode) => {
          peer?.destroy()
          local?.destroy()
          const session = await createPeerHost(name, {
            roomCode,
            avatarUid: slBoot.uid,
          })
          setPeer(session)
          setLocal(null)
          slMatchKind.current = 'mp'
          setStatus(session.status)
        }}
        onJoinedMp={async (roomCode) => {
          peer?.destroy()
          local?.destroy()
          const session = await joinPeerRoom(roomCode, name, { avatarUid: slBoot.uid })
          setPeer(session)
          setLocal(null)
          slMatchKind.current = 'mp'
          setStatus(session.status)
        }}
        onHostStartMp={(tableSt?: TableStatus) => {
          const seats = peer?.seats ?? []
          const roster = tableSt?.roster ?? []
          const uidToSeat = new Map(
            roster.map((r) => [r.uid.toLowerCase(), r.seat] as const),
          )
          const knownSeats = seats.map((s) => {
            const uid = (s.avatarUid || '').toLowerCase()
            if (!uid) return undefined
            return uidToSeat.get(uid)
          })
          wireByPlayerRef.current = buildWireMap({
            playerCount: Math.max(seats.length, 2),
            localMatchIndex: Math.max(0, seats.findIndex((s) => s.isHost)),
            localSeat: slBoot.seat,
            knownSeats,
          })
          prevMatchRef.current = null
          peer?.startMatch()
          bump()
        }}
        onLeaveLobby={async () => {
          peer?.destroy()
          setPeer(null)
          slMatchKind.current = 'none'
        }}
        peerRoomCode={peer?.roomCode}
        peerSeats={peer?.seats}
        isPeerHost={peer?.isHost}
        onPeerReady={() => peer?.setReady(true)}
        onHowToPlay={() => setScreen('help')}
      />,
    )
  }

  if (screen === 'menu') {
    return wrap(
      <div className="shell-menu">
        <div className="menu-card">
          <p className="brand-kicker">Cross-country · 1000 miles</p>
          <h1>ROAD TRIP</h1>
          <p>
            A tabletop race across the country.
            <br />
            Drive, sabotage, and Counter Attack your way to 1000 miles.
          </p>
          <button className="btn primary" onClick={() => setScreen('soloSetup')}>
            Play Solo vs AI
          </button>
          <p className="muted">
            Multiplayer is only at a Road Trip table in Second Life. Sit, Enter Table, then Create or
            Join.
          </p>
          <button className="btn ghost" onClick={() => setScreen('help')}>
            How to Play
          </button>
        </div>
      </div>,
    )
  }

  if (screen === 'help') {
    return wrap(
      <div className="shell-menu">
        <div className="menu-card wide help-card">
          <HowToPlay onClose={() => setScreen(slBoot ? 'sl' : 'menu')} closeLabel="Back" />
        </div>
      </div>,
    )
  }

  if (screen === 'soloSetup') {
    return wrap(
      <div className="shell-menu">
        <div className="menu-card">
          <p className="brand-kicker">Solo</p>
          <h2>Solo Road Trip</h2>
          <label>
            Driver name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            AI opponents (max 3 — 4 drivers total)
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
          <button className="btn primary" onClick={() => void startLocal()}>
            Start Race
          </button>
          <button className="btn ghost" onClick={() => setScreen('menu')}>
            Back
          </button>
        </div>
      </div>,
    )
  }

  if (screen === 'lobby' && !state && !slBoot?.slCap) {
    return wrap(
      <div className="shell-menu">
        <div className="menu-card">
          <p className="brand-kicker">Multiplayer</p>
          <h2>Sit at a table</h2>
          <p>
            Multiplayer only runs from a Road Trip table in Second Life. Sit, Enter Table, then Create
            or Join. Solo vs computer works in this browser anytime.
          </p>
          <button className="btn primary" onClick={() => setScreen('soloSetup')}>
            Play Solo vs AI
          </button>
          <button className="btn ghost" onClick={() => setScreen('menu')}>
            Back
          </button>
        </div>
      </div>,
    )
  }

  if (screen === 'lobby' && !state) {
    return wrap(
      <div className="shell-menu">
        <div className="menu-card">
          <p className="brand-kicker">Multiplayer</p>
          <h2>Multiplayer Lobby</h2>
          <p className="muted">2–4 players at this table. Room fills at 4.</p>
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
          <button className="btn ghost" onClick={() => void leaveToMenu()}>
            Back
          </button>
        </div>
      </div>,
    )
  }

  if (!state) return wrap(<div className="shell-menu" />)

  const myTurn = state.currentPlayer === localIndex && state.phase === MatchPhase.Playing && !aiThinking
  const myDraw = state.currentPlayer === localIndex && state.phase === MatchPhase.AwaitingDraw && !aiThinking
  const myCoup = state.phase === MatchPhase.AwaitingCoupFourre && state.pending?.targetIndex === localIndex
  const myAutoClub =
    state.phase === MatchPhase.AwaitingAutoClub && state.pendingAutoClub?.playerIndex === localIndex

  let coupBanner: ReactNode = null
  if (myCoup) {
    coupBanner = (
      <div className="banner-overlay">
        <div className="banner-card">
          <img className="banner-burst" src={assets.counterBurst} alt="" />
          <h2>You were attacked!</h2>
          <p>Play your matching Safety for a Counter Attack, or take the hit.</p>
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
            Counter Attack
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
  } else if (myAutoClub && state.pendingAutoClub) {
    const cost = state.pendingAutoClub.cost
    coupBanner = (
      <div className="banner-overlay">
        <div className="banner-card">
          <h2>Call the Auto Club?</h2>
          <p>Lose {cost} miles to get towed and back on the road?</p>
          <button
            className="btn primary"
            onClick={() => {
              const move = autoClubAcceptMove(localIndex)
              local?.submit(move)
              peer?.submit(move)
              bump()
            }}
          >
            Yes — tow me (−{cost})
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              const move = autoClubDeclineMove(localIndex)
              local?.submit(move)
              peer?.submit(move)
              bump()
            }}
          >
            No, I'll wait
          </button>
        </div>
      </div>
    )
  }

  let endOverlay: ReactNode = null
  if (state.phase === MatchPhase.Finished) {
    endOverlay = (
      <FinishOverlay
        state={state}
        localIndex={localIndex}
        ctaLabel={slBoot ? 'Back to Table Lobby' : 'Main Menu'}
        onCta={() => void leaveToMenu()}
      />
    )
  }

  return wrap(
    <GameBoard
      state={state}
      localIndex={localIndex}
      log={actionLog}
      legalIndexes={legalIndexes}
      selected={selected}
      target={target}
      myTurn={myTurn}
      myDraw={myDraw}
      aiThinking={aiThinking}
      onSelectCard={setSelected}
      onPlayIndex={playIndex}
      onDiscardIndex={discardIndex}
      onSelectTarget={setTarget}
      onDrawDeck={drawFromDeck}
      onDrawDiscard={drawFromDiscard}
      onMenu={() => void leaveToMenu()}
      coupBanner={coupBanner}
      endOverlay={endOverlay}
    />,
  )
}
