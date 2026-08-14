export enum CardCategory {
  Distance = 1,
  Hazard = 2,
  Remedy = 3,
  Safety = 4,
}

export enum CardId {
  Miles25 = 101,
  Miles50 = 102,
  Miles75 = 103,
  Miles100 = 104,
  Miles200 = 105,

  RedLight = 201,
  Accident = 202,
  OutOfGas = 203,
  FlatTire = 204,
  SpeedLimit = 205,
  TrafficJam = 206,
  GpsError = 207,

  Drive = 301,
  Repairs = 302,
  Gasoline = 303,
  SpareTire = 304,
  EndOfLimit = 305,
  TrafficClear = 306,
  NavigationFix = 307,

  EmergencyVehicle = 401,
  DrivingAce = 402,
  ExtraTank = 403,
  PunctureProof = 404,
  FastLane = 405,
  GpsLock = 406,
}

export enum MoveKind {
  Play = 1,
  Discard = 2,
  CoupFourre = 3,
  DrawDeck = 4,
  DrawDiscard = 5,
  AutoClubAccept = 6,
  AutoClubDecline = 7,
}

export enum MatchPhase {
  WaitingToStart = 0,
  Playing = 1,
  AwaitingCoupFourre = 2,
  Finished = 3,
  AwaitingDraw = 4,
  AwaitingAutoClub = 5,
}

/** Solo and multiplayer seats (1 human + up to 3 others, or 2–4 humans). */
export const MAX_PLAYERS = 4
export const MIN_PLAYERS = 2

export type CardDef = {
  id: CardId
  category: CardCategory
  name: string
  shortName: string
  miles: number
  countersHazard: CardId | 0
  isBattleHazard: boolean
  isSpeedHazard: boolean
  defaultCount: number
}

function def(
  id: CardId,
  category: CardCategory,
  name: string,
  shortName: string,
  opts: Partial<Omit<CardDef, 'id' | 'category' | 'name' | 'shortName'>> = {},
): CardDef {
  return {
    id,
    category,
    name,
    shortName,
    miles: opts.miles ?? 0,
    countersHazard: opts.countersHazard ?? 0,
    isBattleHazard: opts.isBattleHazard ?? false,
    isSpeedHazard: opts.isSpeedHazard ?? false,
    defaultCount: opts.defaultCount ?? 1,
  }
}

export const CARD_DEFS: CardDef[] = [
  def(CardId.Miles25, CardCategory.Distance, '25 Miles', '25', { miles: 25, defaultCount: 10 }),
  def(CardId.Miles50, CardCategory.Distance, '50 Miles', '50', { miles: 50, defaultCount: 10 }),
  def(CardId.Miles75, CardCategory.Distance, '75 Miles', '75', { miles: 75, defaultCount: 10 }),
  def(CardId.Miles100, CardCategory.Distance, '100 Miles', '100', { miles: 100, defaultCount: 12 }),
  def(CardId.Miles200, CardCategory.Distance, '200 Miles', '200', { miles: 200, defaultCount: 4 }),

  def(CardId.RedLight, CardCategory.Hazard, 'Red Light', 'STOP', { isBattleHazard: true, defaultCount: 4 }),
  def(CardId.Accident, CardCategory.Hazard, 'Accident', 'CRASH', { isBattleHazard: true, defaultCount: 3 }),
  def(CardId.OutOfGas, CardCategory.Hazard, 'Out of Gas', 'GAS', { isBattleHazard: true, defaultCount: 3 }),
  def(CardId.FlatTire, CardCategory.Hazard, 'Flat Tire', 'FLAT', { isBattleHazard: true, defaultCount: 3 }),
  def(CardId.SpeedLimit, CardCategory.Hazard, 'Speed Limit', 'LIMIT', { isSpeedHazard: true, defaultCount: 4 }),
  def(CardId.TrafficJam, CardCategory.Hazard, 'Traffic Jam', 'JAM', { isBattleHazard: true, defaultCount: 2 }),
  def(CardId.GpsError, CardCategory.Hazard, 'GPS Error', 'GPS', { isBattleHazard: true, defaultCount: 2 }),

  def(CardId.Drive, CardCategory.Remedy, 'Drive', 'GO', { countersHazard: CardId.RedLight, defaultCount: 14 }),
  def(CardId.Repairs, CardCategory.Remedy, 'Repairs', 'FIX', { countersHazard: CardId.Accident, defaultCount: 8 }),
  def(CardId.Gasoline, CardCategory.Remedy, 'Gasoline', 'FUEL', { countersHazard: CardId.OutOfGas, defaultCount: 8 }),
  def(CardId.SpareTire, CardCategory.Remedy, 'Spare Tire', 'SPARE', { countersHazard: CardId.FlatTire, defaultCount: 8 }),
  def(CardId.EndOfLimit, CardCategory.Remedy, 'End of Limit', 'END', { countersHazard: CardId.SpeedLimit, defaultCount: 8 }),
  def(CardId.TrafficClear, CardCategory.Remedy, 'Traffic Clear', 'CLEAR', { countersHazard: CardId.TrafficJam, defaultCount: 6 }),
  def(CardId.NavigationFix, CardCategory.Remedy, 'Navigation Fix', 'NAV', { countersHazard: CardId.GpsError, defaultCount: 6 }),

  def(CardId.EmergencyVehicle, CardCategory.Safety, 'Emergency Vehicle', 'EV', { countersHazard: CardId.RedLight, defaultCount: 1 }),
  def(CardId.DrivingAce, CardCategory.Safety, 'Driving Ace', 'ACE', { countersHazard: CardId.Accident, defaultCount: 1 }),
  def(CardId.ExtraTank, CardCategory.Safety, 'Extra Tank', 'TANK', { countersHazard: CardId.OutOfGas, defaultCount: 1 }),
  def(CardId.PunctureProof, CardCategory.Safety, 'Puncture-Proof', 'TIRES', { countersHazard: CardId.FlatTire, defaultCount: 1 }),
  def(CardId.FastLane, CardCategory.Safety, 'Fast Lane', 'HOV', { countersHazard: CardId.TrafficJam, defaultCount: 1 }),
  def(CardId.GpsLock, CardCategory.Safety, 'GPS Lock', 'LOCK', { countersHazard: CardId.GpsError, defaultCount: 1 }),
]

const byId = new Map(CARD_DEFS.map((d) => [d.id, d]))

export function getCard(id: CardId): CardDef {
  const d = byId.get(id)
  if (!d) throw new Error(`Unknown card ${id}`)
  return d
}

export function safetyForHazard(hazard: CardId): CardId | 0 {
  switch (hazard) {
    case CardId.RedLight:
    case CardId.SpeedLimit:
      return CardId.EmergencyVehicle
    case CardId.Accident:
      return CardId.DrivingAce
    case CardId.OutOfGas:
      return CardId.ExtraTank
    case CardId.FlatTire:
      return CardId.PunctureProof
    case CardId.TrafficJam:
      return CardId.FastLane
    case CardId.GpsError:
      return CardId.GpsLock
    default:
      return 0
  }
}

export function safetyBlocksHazard(safety: CardId, hazard: CardId): boolean {
  if (safety === CardId.EmergencyVehicle) {
    return hazard === CardId.RedLight || hazard === CardId.SpeedLimit
  }
  return safetyForHazard(hazard) === safety
}
