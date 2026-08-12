/**
 * Map MatchState diffs → pipe payloads for the in-world Track
 * (`EVENT|player|target|CARD|value|miles`). Solo client or MP host only.
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

/** 0-based match index → wire player 1–4. */
export function wirePlayer(playerIndex: number): number {
  return playerIndex + 1
}

export function pipePayload(
  event: string,
  playerIndex: number,
  targetIndex: number,
  cardType: string,
  value: number,
  miles: number,
): string {
  return [
    event,
    wirePlayer(playerIndex),
    wirePlayer(targetIndex),
    cardType,
    value,
    miles,
  ].join('|')
}

/** Diff prev→next into zero or more pipe payloads (ordered for spectators). */
export function payloadsFromState(prev: MatchState | null, next: MatchState): string[] {
  const out: string[] = []

  if (!prev) {
    out.push(pipePayload('GAME_START', 0, 0, 'NONE', 0, 0))
    const cur = next.currentPlayer
    out.push(
      pipePayload('TURN_CHANGE', cur, cur, 'NONE', 0, next.players[cur]?.miles ?? 0),
    )
    return out
  }

  if (prev.phase !== MatchPhase.Finished && next.phase === MatchPhase.Finished) {
    // Rank by miles desc; wire seats into GAME_OVER|1st|2nd|RANK|3rd|4th.
    const ranked = next.players
      .map((p, i) => ({ i, miles: p.miles }))
      .sort((a, b) => b.miles - a.miles)
    const seats = [0, 0, 0, 0]
    for (let r = 0; r < ranked.length && r < 4; r++) {
      seats[r] = wirePlayer(ranked[r]!.i)
    }
    // Prefer declared winner as 1st when present.
    if (next.winnerIndex >= 0) {
      const winSeat = wirePlayer(next.winnerIndex)
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

    if (b.miles > a.miles) {
      const delta = b.miles - a.miles
      out.push(pipePayload('MILEAGE', i, i, 'DISTANCE', delta, b.miles))
    }

    if (b.safeties.length > a.safeties.length) {
      const card = b.safeties[b.safeties.length - 1]!
      out.push(pipePayload('SAFETY', i, i, cardTypeFor(card), 0, b.miles))
    }

    if (b.battlePile.length > a.battlePile.length) {
      const card = b.battlePile[b.battlePile.length - 1]!
      const def = getCard(card)
      if (def.category === CardCategory.Hazard) {
        out.push(pipePayload('HAZARD', attacker, i, cardTypeFor(card), 0, b.miles))
      } else if (def.category === CardCategory.Remedy) {
        // Remedies / GO — self-play; Track keys off CARD_TYPE
        out.push(pipePayload('MILEAGE', i, i, cardTypeFor(card), 0, b.miles))
      }
    }

    if (b.speedPile.length > a.speedPile.length) {
      const card = b.speedPile[b.speedPile.length - 1]!
      const def = getCard(card)
      if (def.category === CardCategory.Hazard) {
        out.push(pipePayload('HAZARD', attacker, i, cardTypeFor(card), 0, b.miles))
      } else {
        out.push(pipePayload('MILEAGE', i, i, cardTypeFor(card), 0, b.miles))
      }
    }
  }

  if (
    prev.currentPlayer !== next.currentPlayer &&
    next.phase !== MatchPhase.Finished
  ) {
    const cur = next.currentPlayer
    out.push(
      pipePayload('TURN_CHANGE', cur, cur, 'NONE', 0, next.players[cur]?.miles ?? 0),
    )
  }

  return out
}

/**
 * Emit track events for a state transition. No-ops for guests / missing cap.
 * Fire-and-forget JSONP; errors are swallowed so play is never blocked.
 */
export function emitFromState(
  prev: MatchState | null,
  next: MatchState,
  opts: TrackEmitOpts,
): void {
  if (!opts.isEmitter || !opts.slCap || !opts.uid) return
  const payloads = payloadsFromState(prev, next)
  for (const p of payloads) {
    void tableEvent(opts.slCap, opts.uid, opts.localSeat, p).catch(() => {
      /* ignore — MOAP / cap blips */
    })
  }
}
