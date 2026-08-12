import Peer, { type DataConnection } from 'peerjs'
import {
  createMatch,
  tryApply,
  declineCoupFourre,
  type MatchState,
  type GameMove,
} from '../core/rules'
import { MAX_PLAYERS, MIN_PLAYERS } from '../core/cards'

export type LobbySeat = { id: string; name: string; ready: boolean; isHost: boolean }

type Wire =
  | { t: 'hello'; id: string; name: string; avatarUid?: string }
  | { t: 'lobby'; seats: LobbySeat[]; roomCode: string }
  | { t: 'ready'; id: string; ready: boolean }
  | { t: 'start'; state: MatchState }
  | { t: 'state'; state: MatchState }
  | { t: 'move'; move: GameMove }
  | { t: 'decline' }
  | { t: 'info'; message: string }

function roomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 5; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return s
}

export type PeerHostOptions = {
  roomCode?: string
  /** When set (SL table), only these avatar UUIDs may join. */
  allowedAvatarUids?: string[]
  avatarUid?: string
}

export type PeerJoinOptions = {
  avatarUid?: string
}

export type PeerSession = {
  roomCode: string
  isHost: boolean
  localId: string
  seats: LobbySeat[]
  state: MatchState | null
  localIndex: number
  status: string
  onChange: (cb: () => void) => () => void
  setReady: (ready: boolean) => void
  startMatch: () => void
  submit: (move: GameMove) => void
  declineCoup: () => void
  destroy: () => void
}

export async function createPeerHost(
  playerName: string,
  opts?: PeerHostOptions,
): Promise<PeerSession> {
  const code = (opts?.roomCode || roomCode()).toUpperCase()
  const peer = new Peer(`roadtrip-${code}-host`)
  await waitOpen(peer)
  return buildSession(peer, code, true, playerName, undefined, opts)
}

export async function joinPeerRoom(
  code: string,
  playerName: string,
  opts?: PeerJoinOptions,
): Promise<PeerSession> {
  const peer = new Peer()
  await waitOpen(peer)
  const conn = peer.connect(`roadtrip-${code.toUpperCase()}-host`, { reliable: true })
  await waitConn(conn)
  return buildSession(peer, code.toUpperCase(), false, playerName, conn, opts)
}

function waitOpen(peer: Peer): Promise<void> {
  return new Promise((resolve, reject) => {
    peer.on('open', () => resolve())
    peer.on('error', (e) => reject(e))
  })
}

function waitConn(conn: DataConnection): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.on('open', () => resolve())
    conn.on('error', (e) => reject(e))
  })
}

function buildSession(
  peer: Peer,
  code: string,
  isHost: boolean,
  playerName: string,
  existingConn?: DataConnection,
  opts?: PeerHostOptions | PeerJoinOptions,
): PeerSession {
  const localId = peer.id
  const localAvatarUid = opts && 'avatarUid' in opts ? opts.avatarUid : undefined
  const allowedAvatarUids =
    opts && 'allowedAvatarUids' in opts && opts.allowedAvatarUids
      ? new Set(opts.allowedAvatarUids.map((u) => u.toLowerCase()))
      : null
  let seats: LobbySeat[] = [
    { id: localId, name: playerName || 'Driver', ready: isHost, isHost: true },
  ]
  let state: MatchState | null = null
  let status = isHost ? `Room ${code} — share this code` : `Joined ${code}`
  const listeners = new Set<() => void>()
  const conns = new Map<string, DataConnection>()
  const notify = () => listeners.forEach((l) => l())

  const send = (conn: DataConnection, msg: Wire) => conn.send(msg)
  const broadcast = (msg: Wire) => {
    conns.forEach((c) => send(c, msg))
  }

  const syncLobby = () => {
    if (!isHost) return
    // Ensure host seat exists
    const hostSeat = seats.find((s) => s.isHost) ?? seats[0]
    seats = seats.map((s) => ({ ...s, isHost: s.id === hostSeat?.id }))
    broadcast({ t: 'lobby', seats, roomCode: code })
    notify()
  }

  const onMessage = (fromId: string, msg: Wire) => {
    if (msg.t === 'hello' && isHost) {
      if (allowedAvatarUids) {
        const uid = (msg.avatarUid || '').toLowerCase()
        if (!uid || !allowedAvatarUids.has(uid)) {
          const c = conns.get(fromId)
          if (c) send(c, { t: 'info', message: 'Not seated/joined at this Road Trip table.' })
          c?.close()
          return
        }
      }
      if (seats.length >= MAX_PLAYERS) {
        const c = conns.get(fromId)
        if (c) send(c, { t: 'info', message: `Room full (max ${MAX_PLAYERS} players).` })
        return
      }
      if (!seats.some((s) => s.id === msg.id)) {
        seats = [...seats, { id: msg.id, name: msg.name, ready: false, isHost: false }]
      }
      syncLobby()
      return
    }
    if (msg.t === 'lobby') {
      seats = msg.seats
      status = `Room ${msg.roomCode}`
      notify()
      return
    }
    if (msg.t === 'ready' && isHost) {
      seats = seats.map((s) => (s.id === msg.id ? { ...s, ready: msg.ready } : s))
      syncLobby()
      return
    }
    if (msg.t === 'start' || msg.t === 'state') {
      state = msg.state
      status = state.lastMessage
      notify()
      return
    }
    if (msg.t === 'move' && isHost && state) {
      const res = tryApply(state, msg.move)
      if (!res.ok) {
        status = res.error
        notify()
        return
      }
      broadcast({ t: 'state', state })
      status = state.lastMessage
      notify()
      return
    }
    if (msg.t === 'decline' && isHost && state) {
      declineCoupFourre(state)
      broadcast({ t: 'state', state })
      status = state.lastMessage
      notify()
      return
    }
    if (msg.t === 'info') {
      status = msg.message
      notify()
    }
  }

  const attach = (conn: DataConnection) => {
    conns.set(conn.peer, conn)
    conn.on('data', (data) => onMessage(conn.peer, data as Wire))
    conn.on('close', () => {
      conns.delete(conn.peer)
      if (isHost) {
        seats = seats.filter((s) => s.id !== conn.peer)
        syncLobby()
      }
    })
    if (isHost) {
      // wait for hello
    } else {
      send(conn, {
        t: 'hello',
        id: localId,
        name: playerName || 'Driver',
        avatarUid: localAvatarUid,
      })
    }
  }

  if (existingConn) attach(existingConn)

  if (isHost) {
    peer.on('connection', (conn) => {
      conn.on('open', () => attach(conn))
    })
    seats = [{ id: localId, name: playerName || 'Host', ready: true, isHost: true }]
  }

  const session: PeerSession = {
    roomCode: code,
    isHost,
    localId,
    get seats() {
      return seats
    },
    get state() {
      return state
    },
    get localIndex() {
      if (!state) return seats.findIndex((s) => s.id === localId)
      const name = seats.find((s) => s.id === localId)?.name
      const idx = state.players.findIndex((p) => p.displayName === name)
      return idx >= 0 ? idx : 0
    },
    get status() {
      return status
    },
    onChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    setReady(ready) {
      if (isHost) {
        seats = seats.map((s) => (s.id === localId ? { ...s, ready } : s))
        syncLobby()
      } else {
        const hostConn = [...conns.values()][0]
        if (hostConn) send(hostConn, { t: 'ready', id: localId, ready })
      }
    },
    startMatch() {
      if (!isHost) {
        status = 'Only host can start.'
        notify()
        return
      }
      if (seats.length < MIN_PLAYERS) {
        status = `Need at least ${MIN_PLAYERS} players.`
        notify()
        return
      }
      if (seats.length > MAX_PLAYERS) {
        status = `Maximum ${MAX_PLAYERS} players.`
        notify()
        return
      }
      const names = seats.map((s) => s.name)
      const humans = seats.map(() => true)
      state = createMatch(names, humans)
      broadcast({ t: 'start', state })
      status = state.lastMessage
      notify()
    },
    submit(move) {
      if (isHost && state) {
        const res = tryApply(state, move)
        if (!res.ok) {
          status = res.error
          notify()
          return
        }
        broadcast({ t: 'state', state })
        status = state.lastMessage
        notify()
      } else {
        const hostConn = [...conns.values()][0]
        if (hostConn) send(hostConn, { t: 'move', move })
      }
    },
    declineCoup() {
      if (isHost && state) {
        declineCoupFourre(state)
        broadcast({ t: 'state', state })
        status = state.lastMessage
        notify()
      } else {
        const hostConn = [...conns.values()][0]
        if (hostConn) send(hostConn, { t: 'decline' })
      }
    },
    destroy() {
      peer.destroy()
    },
  }

  return session
}
