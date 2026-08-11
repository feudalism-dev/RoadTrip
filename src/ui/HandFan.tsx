import type { CardId } from '../core/cards'
import { Card } from './Card'

type Props = {
  hand: CardId[]
  legalIndexes: Set<number>
  selected: number
  myTurn: boolean
  disabled?: boolean
  onSelect: (index: number) => void
  onPlay: (index: number) => void
  onDiscard: (index: number) => void
}

export function HandFan({
  hand,
  legalIndexes,
  selected,
  myTurn,
  disabled,
  onSelect,
  onPlay,
  onDiscard,
}: Props) {
  const n = Math.max(hand.length, 1)

  return (
    <div className={`hand-fan ${myTurn ? 'is-choosing' : ''}`}>
      <div className="hand-rail" />
      {hand.map((id, i) => {
        const legal = myTurn && legalIndexes.has(i)
        const mid = (n - 1) / 2
        const rot = (i - mid) * 5
        const x = (i - mid) * 54
        return (
          <div
            key={`${id}-${i}`}
            className="hand-item"
            style={{
              transform: `translateX(${x}px) rotate(${rot}deg)`,
              zIndex: selected === i ? 40 : i + 1,
            }}
          >
            <Card
              id={id}
              size="lg"
              legal={legal}
              selected={selected === i}
              dimmed={myTurn && !legal}
              draggablePlay={myTurn && !disabled}
              onClick={() => !disabled && onSelect(i)}
              onPlay={() => {
                if (!disabled && legal) onPlay(i)
              }}
              onDiscard={() => {
                if (!disabled && myTurn) onDiscard(i)
              }}
            />
          </div>
        )
      })}
      <p className="hand-hint">
        {myTurn
          ? 'Double-click a lit card to play · drag up to play · drag down to discard'
          : disabled
            ? 'Draw first — double-click the Draw or Discard pile'
            : 'Waiting for other drivers…'}
      </p>
    </div>
  )
}
