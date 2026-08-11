import type { ReactNode } from 'react'
import { CardId, CardCategory, getCard } from '../core/cards'
import type { MatchState } from '../core/rules'
import { battleTop, speedTop, canDrive } from '../core/state'
import { Card } from './Card'
import { hazardFixHint } from './cardMeta'
import { Tooltip } from './Tooltip'

type Props = {
  state: MatchState
  playerIndex: number
  localIndex: number
  selectedAsTarget?: boolean
  onSelectTarget?: () => void
}

export function Tableau({ state, playerIndex, localIndex, selectedAsTarget, onSelectTarget }: Props) {
  const p = state.players[playerIndex]!
  const mine = playerIndex === localIndex
  const battle = battleTop(p)
  const speed = speedTop(p)
  const moving = canDrive(p)
  const battleCard = battle === 0 ? null : battle
  const speedCard = speed === 0 ? null : speed
  const hazardActive =
    battleCard !== null &&
    getCard(battleCard).category === CardCategory.Hazard &&
    getCard(battleCard).isBattleHazard
  const theirTurn = state.currentPlayer === playerIndex

  return (
    <section
      className={[
        'tableau-board',
        mine ? 'is-mine' : 'is-foe',
        selectedAsTarget ? 'is-target' : '',
        theirTurn ? 'is-turn' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={!mine ? onSelectTarget : undefined}
    >
      <header className="tableau-head">
        <div>
          <span className="tableau-who">{mine ? 'YOU' : 'OPPONENT'}</span>
          <h3>{p.displayName}</h3>
        </div>
        <div className="tableau-miles">
          <strong>{p.miles}</strong>
          <span>/ {state.config.goalMiles}</span>
        </div>
      </header>

      {theirTurn && <div className="tableau-turn-flag">{mine ? 'Your turn' : 'Their turn'}</div>}

      {hazardActive && battleCard !== null && (
        <div className="hazard-callout" role="status">
          <span className="hazard-ico">!</span>
          <div>
            <strong>{getCard(battleCard).name}</strong>
            <p>{hazardFixHint(battleCard)}</p>
          </div>
        </div>
      )}

      <div className="tableau-slots">
        <Slot label="Battle Zone" hint={moving ? 'Moving' : 'Stopped'}>
          {battleCard !== null ? <Card id={battleCard} size="sm" /> : <EmptySlot text="Need Drive" />}
        </Slot>
        <Slot label="Speed Zone" hint={speedCard === CardId.SpeedLimit ? 'Limited' : 'Open'}>
          {speedCard !== null ? <Card id={speedCard} size="sm" /> : <EmptySlot text="Open road" />}
        </Slot>
        <div className="safety-rack">
          <span className="slot-label">Safeties</span>
          <div className="safety-row">
            {p.safeties.length === 0 && <EmptySlot text="None" tiny />}
            {p.safeties.map((s) => (
              <Tooltip key={s} title={getCard(s).name} body={getCard(s).name + ' — permanent immunity.'}>
                <span className="safety-chip">{getCard(s).shortName}</span>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Slot({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="slot">
      <div className="slot-meta">
        <span className="slot-label">{label}</span>
        <span className="slot-hint">{hint}</span>
      </div>
      <div className="slot-pad">{children}</div>
    </div>
  )
}

function EmptySlot({ text, tiny }: { text: string; tiny?: boolean }) {
  return <div className={`empty-slot ${tiny ? 'tiny' : ''}`}>{text}</div>
}
