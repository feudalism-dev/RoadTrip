import { CardCategory, CardId, getCard, safetyForHazard } from '../core/cards'

export type CardVisual = {
  accent: 'green' | 'red' | 'amber' | 'blue'
  icon: string
  blurb: string
  tip: string
}

const TIPS: Partial<Record<CardId, { icon: string; blurb: string; tip: string }>> = {
  [CardId.Miles25]: { icon: '25', blurb: 'Travel 25 miles.', tip: 'Only while Driving (green light). Cannot overshoot 1000.' },
  [CardId.Miles50]: { icon: '50', blurb: 'Travel 50 miles.', tip: 'Only while Driving. OK under Speed Limit.' },
  [CardId.Miles75]: { icon: '75', blurb: 'Travel 75 miles.', tip: 'Only while Driving. Blocked by Speed Limit.' },
  [CardId.Miles100]: { icon: '100', blurb: 'Travel 100 miles.', tip: 'Only while Driving. Blocked by Speed Limit.' },
  [CardId.Miles200]: { icon: '200', blurb: 'Travel 200 miles.', tip: 'Max two per race. Blocked by Speed Limit.' },
  [CardId.RedLight]: { icon: 'STOP', blurb: 'Stop an opponent who is Driving.',     tip: 'They must play Drive to go again. Counter Attack with Emergency Vehicle.' },
  [CardId.Accident]: { icon: 'CRASH', blurb: 'Cause an accident.', tip: 'Fixed by Repairs. Counter Attack with Driving Ace.' },
  [CardId.OutOfGas]: { icon: 'EMPTY', blurb: 'Drain their tank.', tip: 'Fixed by Gasoline. Counter Attack with Extra Tank.' },
  [CardId.FlatTire]: { icon: 'FLAT', blurb: 'Blow out a tire.', tip: 'Fixed by Spare Tire. Counter Attack with Puncture-Proof.' },
  [CardId.SpeedLimit]: { icon: 'LIM', blurb: 'Force 25/50 only.', tip: 'Fixed by End of Limit. Counter Attack with Emergency Vehicle.' },
  [CardId.TrafficJam]: { icon: 'JAM', blurb: 'Gridlock ahead.', tip: 'Fixed by Traffic Clear. Counter Attack with Fast Lane.' },
  [CardId.GpsError]: { icon: 'GPS', blurb: 'Bad navigation.', tip: 'Fixed by Navigation Fix. Counter Attack with GPS Lock.' },
  [CardId.Drive]: { icon: 'GO', blurb: 'Get moving.', tip: 'Required to play miles. Also clears Red Light.' },
  [CardId.Repairs]: { icon: 'FIX', blurb: 'Repair accident.', tip: 'Clears Accident and restores GO — you may play miles again.' },
  [CardId.Gasoline]: { icon: 'FUEL', blurb: 'Refuel.', tip: 'Clears Out of Gas and restores GO — you may play miles again.' },
  [CardId.SpareTire]: { icon: 'SPARE', blurb: 'Change the tire.', tip: 'Clears Flat Tire and restores GO — you may play miles again.' },
  [CardId.EndOfLimit]: { icon: 'END', blurb: 'Lift speed limit.', tip: 'Clears Speed Limit from the speed zone.' },
  [CardId.TrafficClear]: { icon: 'CLEAR', blurb: 'Open the road.', tip: 'Clears Traffic Jam and restores GO — you may play miles again.' },
  [CardId.NavigationFix]: { icon: 'NAV', blurb: 'Recalculate route.', tip: 'Clears GPS Error and restores GO — you may play miles again.' },
  [CardId.EmergencyVehicle]: { icon: 'EV', blurb: 'Priority status.', tip: 'Immune to Red Light & Speed Limit. Counter Attack when hit. Extra turn. No Drive required when clear.' },
  [CardId.DrivingAce]: { icon: 'ACE', blurb: 'Master driver.', tip: 'Immune to Accident. Counter Attack when hit. Extra turn when played.' },
  [CardId.ExtraTank]: { icon: 'TANK', blurb: 'Reserve fuel.', tip: 'Immune to Out of Gas. Counter Attack when hit. Extra turn when played.' },
  [CardId.PunctureProof]: { icon: 'TIRES', blurb: 'Run-flats.', tip: 'Immune to Flat Tire. Counter Attack when hit. Extra turn when played.' },
  [CardId.FastLane]: { icon: 'HOV', blurb: 'HOV access.', tip: 'Immune to Traffic Jam. Counter Attack when hit. Extra turn when played.' },
  [CardId.GpsLock]: { icon: 'LOCK', blurb: 'Hardened GPS.', tip: 'Immune to GPS Error. Counter Attack when hit. Extra turn when played.' },
}

export function cardVisual(id: CardId): CardVisual {
  const def = getCard(id)
  const meta = TIPS[id] ?? { icon: def.shortName, blurb: def.name, tip: '' }
  let accent: CardVisual['accent'] = 'amber'
  if (def.category === CardCategory.Distance) accent = 'green'
  else if (def.category === CardCategory.Hazard) accent = 'red'
  else if (def.category === CardCategory.Remedy) accent = 'amber'
  else accent = 'blue'
  return { accent, icon: meta.icon, blurb: meta.blurb, tip: meta.tip }
}

export function hazardFixHint(hazard: CardId): string {
  const safety = safetyForHazard(hazard)
  const remedy =
    hazard === CardId.RedLight
      ? 'Drive'
      : hazard === CardId.SpeedLimit
        ? 'End of Limit'
        : getCard(
            ([
              CardId.Repairs,
              CardId.Gasoline,
              CardId.SpareTire,
              CardId.TrafficClear,
              CardId.NavigationFix,
            ].find((r) => getCard(r).countersHazard === hazard) ?? CardId.Drive),
          ).name
  const safetyName = safety ? getCard(safety).name : 'matching Safety'
  return `Play ${remedy} or ${safetyName} to continue!`
}
