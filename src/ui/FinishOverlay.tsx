import type { MatchState } from '../core/rules'

export type FinishStanding = {
  playerIndex: number
  name: string
  miles: number
  place: number
  isYou: boolean
}

export function finishStandings(state: MatchState, localIndex: number): FinishStanding[] {
  const rows = state.players.map((p, i) => ({
    playerIndex: i,
    name: p.displayName,
    miles: p.miles,
    isYou: i === localIndex,
  }))
  rows.sort((a, b) => {
    if (b.miles !== a.miles) return b.miles - a.miles
    return a.playerIndex - b.playerIndex
  })
  let place = 1
  return rows.map((r, idx) => {
    if (idx > 0 && r.miles < rows[idx - 1]!.miles) place = idx + 1
    return { ...r, place }
  })
}

function placeCopy(
  place: number,
  field: number,
  tiedForFirst: boolean,
): { kicker: string; title: string; blurb: string; tone: string } {
  if (place === 1 && tiedForFirst) {
    return {
      kicker: 'Finish',
      title: "IT'S A TIE",
      blurb: 'Same miles at the front — you share the lead.',
      tone: 'tie',
    }
  }
  if (place === 1) {
    return {
      kicker: 'Finish',
      title: 'YOU WON',
      blurb: 'You made it to the end of the road.',
      tone: 'win',
    }
  }
  if (place === field) {
    return {
      kicker: 'Finish',
      title: 'SORRY YOU CAME IN LAST',
      blurb: 'Try again!',
      tone: 'last',
    }
  }
  if (place === 2) {
    return {
      kicker: 'Finish',
      title: 'YOU CAME IN SECOND',
      blurb: 'Close — next time take the cup.',
      tone: 'second',
    }
  }
  return {
    kicker: 'Finish',
    title: 'YOU CAME IN THIRD',
    blurb: 'Still on the podium. Push for the win next race.',
    tone: 'third',
  }
}

const CONFETTI = Array.from({ length: 48 }, (_, i) => {
  const hue = [42, 12, 145, 205, 0, 48][i % 6]!
  return {
    left: `${(i * 17 + 8) % 100}%`,
    delay: `${(i % 12) * 0.12}s`,
    duration: `${2.4 + (i % 7) * 0.22}s`,
    rotate: `${(i * 47) % 360}deg`,
    color: `hsl(${hue} 85% 58%)`,
    width: `${6 + (i % 4) * 2}px`,
    height: `${10 + (i % 3) * 3}px`,
  }
})

type Props = {
  state: MatchState
  localIndex: number
  ctaLabel: string
  onCta: () => void
}

export function FinishOverlay({ state, localIndex, ctaLabel, onCta }: Props) {
  const ranked = finishStandings(state, localIndex)
  const me = ranked.find((r) => r.isYou) ?? ranked[0]!
  const tiedForFirst = ranked.filter((r) => r.place === 1).length > 1
  const copy = placeCopy(me.place, ranked.length, tiedForFirst)
  const confetti = copy.tone === 'win' || copy.tone === 'tie'
  const reachedGoal = me.miles >= state.config.goalMiles

  return (
    <div className={`finish-overlay tone-${copy.tone}`} role="dialog" aria-modal="true" aria-label={copy.title}>
      {confetti && (
        <div className="finish-confetti" aria-hidden>
          {CONFETTI.map((p, i) => (
            <span
              key={i}
              className="finish-bit"
              style={{
                left: p.left,
                animationDelay: p.delay,
                animationDuration: p.duration,
                background: p.color,
                width: p.width,
                height: p.height,
              }}
            />
          ))}
        </div>
      )}
      <div className="finish-card">
        <p className="brand-kicker">{copy.kicker}</p>
        <h2 className="finish-title">{copy.title}</h2>
        <p className="finish-blurb">{copy.blurb}</p>
        <p className="finish-miles">
          {me.miles} miles
          {me.place === 1 && tiedForFirst ? ' · tied for the lead' : ''}
          {me.place === 1 && !tiedForFirst && reachedGoal ? ' · first to the finish' : ''}
          {me.place === 1 && !tiedForFirst && !reachedGoal ? ' · in the lead' : ''}
        </p>
        <ol className="finish-board">
          {ranked.map((r) => (
            <li key={r.playerIndex} className={r.isYou ? 'is-you' : undefined}>
              <span className="finish-place">{r.place}</span>
              <span className="finish-name">
                {r.name}
                {r.isYou ? ' (you)' : ''}
              </span>
              <span className="finish-score">{r.miles}</span>
            </li>
          ))}
        </ol>
        <button type="button" className="btn primary finish-cta" onClick={onCta}>
          {ctaLabel}
        </button>
      </div>
    </div>
  )
}
