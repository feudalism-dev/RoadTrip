import { useEffect, useState } from 'react'
import type { SlBootstrap } from '../sl/bootstrap'
import {
  tableClaimSolo,
  tableCreate,
  tableEndGame,
  tableEnter,
  tableJoin,
  tableStart,
  tableStatus,
  type TableStatus,
} from '../sl/tableApi'

type Props = {
  boot: SlBootstrap
  displayName: string
  onNameChange: (name: string) => void
  busy: boolean
  setBusy: (v: boolean) => void
  status: string
  setStatus: (s: string) => void
  onStartSolo: () => void | Promise<void>
  aiCount: number
  onAiCountChange: (n: number) => void
  onCreatedMp: (roomCode: string, tableStatus: TableStatus) => void | Promise<void>
  onJoinedMp: (roomCode: string, tableStatus: TableStatus) => void | Promise<void>
  onHostStartMp: (tableStatus?: TableStatus) => void | Promise<void>
  onLeaveLobby?: () => void | Promise<void>
  peerRoomCode?: string
  peerSeats?: { id: string; name: string; ready: boolean; isHost: boolean }[]
  isPeerHost?: boolean
  onPeerReady?: () => void
  onHowToPlay?: () => void
}

export function SlTableScreens({
  boot,
  displayName,
  onNameChange,
  busy,
  setBusy,
  status,
  setStatus,
  onStartSolo,
  aiCount,
  onAiCountChange,
  onCreatedMp,
  onJoinedMp,
  onHostStartMp,
  onLeaveLobby,
  peerRoomCode,
  peerSeats,
  isPeerHost,
  onPeerReady,
  onHowToPlay,
}: Props) {
  const [entered, setEntered] = useState(false)
  const [table, setTable] = useState<TableStatus | null>(null)
  const [err, setErr] = useState('')

  const refresh = async () => {
    if (!boot.slCap) {
      setTable({
        ok: true,
        mode: 'idle',
        activeCount: entered ? 1 : 0,
        seatedCount: 1,
        roster: [
          {
            seat: boot.seat,
            uid: boot.uid,
            name: displayName,
            active: entered,
            joined: false,
          },
        ],
      })
      return
    }
    try {
      const st = await tableStatus(boot.slCap, boot.uid, boot.seat)
      setTable(st)
      setErr(st.ok ? '' : st.error || 'Table error')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Cannot reach table')
    }
  }

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 3000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll boot identity only
  }, [boot.slCap, boot.uid, boot.seat, entered, displayName])

  const mode = table?.mode || 'idle'
  const activeCount = table?.activeCount ?? 0
  const me = table?.roster?.find((r) => r.uid.toLowerCase() === boot.uid.toLowerCase())
  const iAmHost = (table?.hostUid || '').toLowerCase() === boot.uid.toLowerCase()
  const iJoined = !!me?.joined
  const tableBusy = mode !== 'idle'
  const canSolo = entered && !tableBusy && activeCount <= 1
  const canCreate = entered && !tableBusy && activeCount >= 2
  const canJoin = entered && mode === 'lobby' && !iJoined
  const showMpLobby = mode === 'lobby' || mode === 'match' || !!peerRoomCode

  if (!entered) {
    return (
      <div className="shell-menu">
        <div className="menu-card">
          <p className="brand-kicker">Table · Seat {boot.seat >= 0 ? boot.seat + 1 : '?'}</p>
          <h1>ROAD TRIP</h1>
          <p className="sl-meta">
            Table {boot.tableId.slice(0, 8)}…
          </p>
          <p>
            Enter Table for in-world cars and multiplayer. Solo vs computer works in this browser
            without entering — the track stays idle until you Enter and start Solo from the lobby.
          </p>
          <label>
            Display name
            <input value={displayName} onChange={(e) => onNameChange(e.target.value)} />
          </label>
          <label>
            AI opponents
            <select
              value={aiCount}
              onChange={(e) => onAiCountChange(Number(e.target.value))}
              disabled={busy}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
          {!boot.slCap && (
            <p className="muted">
              No table HTTP link (<code>sl_cap</code>) yet — cars/screens will not update until the
              table finishes HTTP-IN setup. Wait a few seconds, or stand and sit again. You can still
              race the computer in this browser.
            </p>
          )}
          <button
            className="btn primary"
            disabled={busy || !boot.slCap}
            title={!boot.slCap ? 'Waiting for table HTTP-IN URL' : undefined}
            onClick={async () => {
              setBusy(true)
              setErr('')
              try {
                if (boot.slCap) {
                  const st = await tableEnter(boot.slCap, boot.uid, boot.seat, displayName)
                  setTable(st)
                  if (!st.ok) throw new Error(st.error || 'Enter failed')
                }
                setEntered(true)
                setStatus('Entered table — you are Active.')
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Enter failed')
              } finally {
                setBusy(false)
              }
            }}
          >
            Enter Table
          </button>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={() => {
              setErr('')
              void onStartSolo()
              setStatus('Browser-only race vs AI — table not locked.')
            }}
          >
            Play Solo vs AI
          </button>
          {onHowToPlay && (
            <button type="button" className="btn ghost" onClick={onHowToPlay}>
              How to Play
            </button>
          )}
          {err && <p className="sl-error">{err}</p>}
          {status && <p className="muted">{status}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="shell-menu">
      <div className="menu-card wide">
        <p className="brand-kicker">Table lobby</p>
        <h2>Table Lobby</h2>
        <p className="sl-meta">
          Mode: <strong>{mode}</strong> · Active {activeCount} · Seated {table?.seatedCount ?? '?'}
          {!boot.slCap ? ' · (offline cap)' : ''}
        </p>

        <ul className="sl-roster">
          {(table?.roster || []).map((r) => (
            <li key={r.uid}>
              Seat {r.seat + 1}: {r.name || r.uid.slice(0, 8)}
              {r.active ? ' · Active' : ' · seated only'}
              {r.joined ? ' · Joined' : ''}
              {r.uid.toLowerCase() === boot.uid.toLowerCase() ? ' · (you)' : ''}
            </li>
          ))}
        </ul>

        {!showMpLobby && (
          <>
            <label>
              AI opponents
              <select
                value={aiCount}
                onChange={(e) => onAiCountChange(Number(e.target.value))}
                disabled={busy}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
            <button
              className="btn primary"
              disabled={busy || !canSolo}
              title={
                !canSolo
                  ? tableBusy
                    ? 'Table has a game in progress'
                    : 'Solo only when you are the only Active player'
                  : undefined
              }
              onClick={async () => {
                setBusy(true)
                setErr('')
                try {
                  if (boot.slCap) {
                    const players = 1 + Math.max(1, Math.min(3, aiCount))
                    const st = await tableClaimSolo(boot.slCap, boot.uid, boot.seat, players)
                    setTable(st)
                    if (!st.ok) throw new Error(st.error || 'Cannot start solo')
                  }
                  await onStartSolo()
                } catch (e) {
                  setErr(e instanceof Error ? e.message : 'Solo failed')
                } finally {
                  setBusy(false)
                }
              }}
            >
              Play Solo vs AI
            </button>
            <button
              className="btn secondary"
              disabled={busy || !canCreate}
              title={
                !canCreate
                  ? tableBusy
                    ? 'Table busy'
                    : 'Need 2+ Active players at this table'
                  : undefined
              }
              onClick={async () => {
                setBusy(true)
                setErr('')
                try {
                  if (!boot.slCap) throw new Error('Table HTTP-IN required for multiplayer')
                  const st = await tableCreate(boot.slCap, boot.uid, boot.seat)
                  setTable(st)
                  if (!st.ok || !st.roomCode) throw new Error(st.error || 'Create failed')
                  await onCreatedMp(st.roomCode, st)
                  setStatus(`Created room ${st.roomCode}`)
                } catch (e) {
                  setErr(e instanceof Error ? e.message : 'Create failed')
                } finally {
                  setBusy(false)
                }
              }}
            >
              Create Multiplayer Game
            </button>
          </>
        )}

        {mode === 'lobby' && !iJoined && !iAmHost && (
          <button
            className="btn primary"
            disabled={busy || !canJoin}
            onClick={async () => {
              setBusy(true)
              setErr('')
              try {
                if (!boot.slCap) throw new Error('Table HTTP-IN required')
                const st = await tableJoin(boot.slCap, boot.uid, boot.seat)
                setTable(st)
                if (!st.ok || !st.roomCode) throw new Error(st.error || 'Join failed')
                await onJoinedMp(st.roomCode, st)
                setStatus(`Joined room ${st.roomCode}`)
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Join failed')
              } finally {
                setBusy(false)
              }
            }}
          >
            Join Multiplayer Game
          </button>
        )}

        {(iJoined || iAmHost || peerRoomCode) && (mode === 'lobby' || peerRoomCode) && (
          <div className="sl-mp-panel">
            <p>
              Room <strong>{table?.roomCode || peerRoomCode}</strong>
              {iAmHost || isPeerHost ? ' · You are host' : ' · Joined — wait for host'}
            </p>
            {peerSeats && peerSeats.length > 0 && (
              <ul>
                {peerSeats.map((s) => (
                  <li key={s.id}>
                    {s.isHost ? '[Host] ' : ''}
                    {s.name}
                    {s.ready ? ' ✓' : ''}
                  </li>
                ))}
              </ul>
            )}
            {onPeerReady && (
              <button className="btn secondary" disabled={busy} onClick={() => onPeerReady()}>
                Ready
              </button>
            )}
            {(iAmHost || isPeerHost) && mode === 'lobby' && (
              <button
                className="btn primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  setErr('')
                  try {
                    if (boot.slCap) {
                      const st = await tableStart(boot.slCap, boot.uid, boot.seat)
                      setTable(st)
                      if (!st.ok) throw new Error(st.error || 'Start failed')
                      await onHostStartMp(st)
                    } else {
                      await onHostStartMp()
                    }
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : 'Start failed')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Start Match
              </button>
            )}
            <button
              className="btn ghost"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  if (boot.slCap) {
                    const st = await tableEndGame(boot.slCap, boot.uid, boot.seat)
                    setTable(st)
                  }
                  await onLeaveLobby?.()
                  setStatus('Left the multiplayer lobby.')
                } finally {
                  setBusy(false)
                  void refresh()
                }
              }}
            >
              Leave Lobby
            </button>
          </div>
        )}

        {mode === 'match' && !iJoined && (
          <p className="muted">A match is in progress. You can join the next game when it ends.</p>
        )}

        {mode === 'solo' && table?.soloUid?.toLowerCase() !== boot.uid.toLowerCase() && (
          <p className="muted">Another player is in a solo race. One game per table.</p>
        )}

        {err && <p className="sl-error">{err}</p>}
        {status && <p className="muted">{status}</p>}
      </div>
    </div>
  )
}
