/**
 * Map MatchState diffs → pipe payloads for the in-world Track
 * (`EVENT|player|target|CARD|value|miles`). Solo client or MP host only.
 *
 * Wire player 1–4 = AVsitter seat 0–3 + 1 (physical car lanes), NOT raw match index.
 */

import { CardCategory, CardId, MatchPhase, getCard } from '../core/cards'
import type { MatchState } from '../core/state'
import { tableEvent } from './tableApi'

export type TrackEmitOpts = {
  slCap: string
  uid: string
  /** AVsitter seat 0–3 (auth hint for table HTTP). */
  localSeat: number
  /** Solo local match or PeerJS host — guests must pass false. */
  isEmitter: boolean
  /**
   * Match player index → wire lane 1–4 (AVsitter seat + 1).
   * Built once at match start so AI/humans land on the correct cars.
   */
  wireByPlayer: number[]
}

/** CardId → pipe CARD_TYPE (matches TABLE_SCREEN_ASSETS / funcSpec). */
export function cardTypeFor(card: CardId): string {
  switch (card) {
    case CardId.Miles25:
    case CardId.Miles50:
    case CardId.Miles75:
    case CardId.Miles100:
    case CardId.Miles200:
      return 'DISTANCE'
    case CardId.RedLight:
      return 'STOP'
    case CardId.Accident:
      return 'ACCIDENT'
    case CardId.OutOfGas:
      return 'OUT_OF_GAS'
    case CardId.FlatTire:
      return 'FLAT_TIRE'
    case CardId.SpeedLimit:
      return 'LIMIT'
    case CardId.TrafficJam:
      return 'TRAFFIC_JAM'
    case CardId.GpsError:
      return 'GPS_ERROR'
    case CardId.Drive:
      return 'GO'
    case CardId.Repairs:
      return 'REPAIRS'
    case CardId.Gasoline:
      return 'GASOLINE'
    case CardId.SpareTire:
      return 'SPARE_TIRE'
    case CardId.EndOfLimit:
      return 'END_LIMIT'
    case CardId.TrafficClear:
      return 'TRAFFIC_CLEAR'
    case CardId.NavigationFix:
      return 'NAV_FIX'
    case CardId.EmergencyVehicle:
      return 'EV'
    case CardId.DrivingAce:
      return 'ACE'
    case CardId.ExtraTank:
      return 'TANK'
    case CardId.PunctureProof:
      return 'TIRES'
    case CardId.FastLane:
      return 'HOV'
    case CardId.GpsLock:
      return 'LOCK'
    default:
      return 'NONE'
  }
}

/**
 * Assign wire lanes (1–4) for each match player.
 * Local human keeps `localSeat`; others fill unused seats in order (matches Table solo AI lanes).
 * Optional `knownSeats` (match index → AVsitter 0–3) pins multiplayer humans.
 */
export function buildWireMap(opts: {
  playerCount: number
  localMatchIndex: number
  localSeat: number
  knownSeats?: Array<number | undefined | null>
}): number[] {
  const n = Math.max(1, Math.min(4, opts.playerCount))
  const map = new Array<number>(n).fill(0)
  const used = new Set<number>()

  const take = (matchIndex: number, seat0: number) => {
    if (matchIndex < 0 || matchIndex >= n) return
    if (seat0 < 0 || seat0 > 3 || used.has(seat0)) return
    if (map[matchIndex]! > 0) return
    map[matchIndex] = seat0 + 1
    used.add(seat0)
  }

  if (opts.localSeat >= 0 && opts.localSeat <= 3) {
    take(opts.localMatchIndex, opts.localSeat)
  }

  opts.knownSeats?.forEach((seat0, i) => {
    if (seat0 == null) return
    take(i, seat0)
  })

  for (let i = 0; i < n; i++) {
    if (map[i]! > 0) continue
    for (let s = 0; s < 4; s++) {
      if (!used.has(s)) {
        map[i] = s + 1
        used.add(s)
        break
      }
    }
  }

  // Absolute fallback (should not hit)
  for (let i = 0; i < n; i++) {
    if (map[i]! < 1) map[i] = i + 1
  }
  return map
}

function wireOf(map: number[], playerIndex: number): number {
  const w = map[playerIndex]
  if (w != null && w >= 1 && w <= 4) return w
  return Math.min(4, Math.max(1, playerIndex + 1))
}

/** Furware set width; strip pipes so LSL parse stays 4 lanes. */
export function sanitizeFwName(name: string): string {
  return name.replace(/\|/g, ' ').trim().slice(0, 32)
}

/** NAMES|seat0|seat1|seat2|seat3 — Track keeps SL display names on occupied seats. */
export function namesPipe(next: MatchState, map: number[]): string {
  const labels = ['', '', '', '']
  next.players.forEach((p, i) => {
    const w = wireOf(map, i)
    if (w < 1 || w > 4) return
    labels[w - 1] = sanitizeFwName(p.displayName)
  })
  return ['NAMES', ...labels].join('|')
}

export function pipePayload(
  map: number[],
  event: string,
  playerIndex: number,
  targetIndex: number,
  cardType: string,
  value: number,
  miles: number,
): string {
  return [
    event,
    wireOf(map, playerIndex),
    wireOf(map, targetIndex),
    cardType,
    value,
    miles,
  ].join('|')
}

/** Diff prev→next into zero or more pipe payloads (ordered for spectators). */
export function payloadsFromState(
  prev: MatchState | null,
  next: MatchState,
  wireByPlayer: number[],
): string[] {
  const out: string[] = []
  const map =
    wireByPlayer.length >= next.players.length
      ? wireByPlayer
      : buildWireMap({
          playerCount: next.players.length,
          localMatchIndex: 0,
          localSeat: 0,
        })

  if (!prev) {
    out.push(pipePayload(map, 'GAME_START', 0, 0, 'NONE', 0, 0))
    out.push(namesPipe(next, map))
    const cur = next.currentPlayer
    out.push(
      pipePayload(map, 'TURN_CHANGE', cur, cur, 'NONE', 0, next.players[cur]?.miles ?? 0),
    )
    return out
  }

  if (prev.phase !== MatchPhase.Finished && next.phase === MatchPhase.Finished) {
    const ranked = next.players
      .map((p, i) => ({ i, miles: p.miles }))
      .sort((a, b) => b.miles - a.miles)
    const seats = [0, 0, 0, 0]
    for (let r = 0; r < ranked.length && r < 4; r++) {
      seats[r] = wireOf(map, ranked[r]!.i)
    }
    if (next.winnerIndex >= 0) {
      const winSeat = wireOf(map, next.winnerIndex)
      const others = seats.filter((s) => s !== winSeat && s > 0)
      seats[0] = winSeat
      seats[1] = others[0] ?? 0
      seats[2] = others[1] ?? 0
      seats[3] = others[2] ?? 0
    }
    out.push(
      ['GAME_OVER', seats[0], seats[1], 'RANK', seats[2], seats[3]].join('|'),
    )
    return out
  }

  const n = Math.min(prev.players.length, next.players.length)
  const attacker = prev.currentPlayer

  for (let i = 0; i < n; i++) {
    const a = prev.players[i]!
    const b = next.players[i]!

    if (b.miles !== a.miles) {
      const delta = b.miles - a.miles
      out.push(
        pipePayload(map, 'MILEAGE', i, i, delta < 0 ? 'GO' : 'DISTANCE', delta < 0 ? 0 : delta, b.miles),
      )
    }

    if (b.safeties.length > a.safeties.length) {
      const card = b.safeties[b.safeties.length - 1]!
      out.push(pipePayload(map, 'SAFETY', i, i, cardTypeFor(card), 0, b.miles))
    }

    if (b.battlePile.length > a.battlePile.length) {
      const card = b.battlePile[b.battlePile.length - 1]!
      const def = getCard(card)
      if (def.category === CardCategory.Hazard) {
        out.push(pipePayload(map, 'HAZARD', attacker, i, cardTypeFor(card), 0, b.miles))
      } else if (def.category === CardCategory.Remedy) {
        out.push(pipePayload(map, 'MILEAGE', i, i, cardTypeFor(card), 0, b.miles))
      }
    } else if (b.battlePile.length < a.battlePile.length && b.safeties.length <= a.safeties.length) {
      out.push(pipePayload(map, 'REMEDY', i, i, 'GO', 0, b.miles))
    }

    if (b.speedPile.length > a.speedPile.length) {
      const card = b.speedPile[b.speedPile.length - 1]!
      const def = getCard(card)
      if (def.category === CardCategory.Hazard) {
        out.push(pipePayload(map, 'HAZARD', attacker, i, cardTypeFor(card), 0, b.miles))
      } else {
        out.push(pipePayload(map, 'MILEAGE', i, i, cardTypeFor(card), 0, b.miles))
      }
    }
  }

  if (
    prev.currentPlayer !== next.currentPlayer &&
    next.phase !== MatchPhase.Finished
  ) {
    const cur = next.currentPlayer
    out.push(
      pipePayload(map, 'TURN_CHANGE', cur, cur, 'NONE', 0, next.players[cur]?.miles ?? 0),
    )
  }

  return out
}

/**
 * Emit track events for a state transition. No-ops for guests / missing cap.
 * Events are sent sequentially; after a HAZARD we pause so HIT/PLAY screens
 * are visible before TURN_CHANGE overwrites them.
 *
 * Critical: all emits share one promise chain. Parallel hazard sleeps used to
 * let a stale TURN_CHANGE land after a newer one (wrong seat stuck on YOUR TURN).
 */
let emitChain: Promise<void> = Promise.resolve()

export function emitFromState(
  prev: MatchState | null,
  next: MatchState,
  opts: TrackEmitOpts,
): void {
  if (!opts.isEmitter || !opts.slCap || !opts.uid) return
  const payloads = payloadsFromState(prev, next, opts.wireByPlayer)
  if (!payloads.length) return

  const { slCap, uid, localSeat } = opts
  emitChain = emitChain
    .then(async () => {
      let pauseAfterHazard = false
      for (const p of payloads) {
        if (pauseAfterHazard) {
          await sleep(HAZARD_SCREEN_HOLD_MS)
          pauseAfterHazard = false
        }
        try {
          await tableEvent(slCap, uid, localSeat, p)
        } catch {
          /* ignore — MOAP / cap blips */
        }
        if (p.startsWith('HAZARD|')) pauseAfterHazard = true
      }
    })
    .catch(() => {
      /* keep chain alive after a failed batch */
    })
}

const HAZARD_SCREEN_HOLD_MS = 2800

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
