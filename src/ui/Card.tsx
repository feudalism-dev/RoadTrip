import { motion } from 'framer-motion'
import { useRef, type CSSProperties, type DragEvent, type ReactNode } from 'react'
import type { CardId } from '../core/cards'
import { CardCategory, getCard } from '../core/cards'
import { cardVisual } from './cardMeta'
import { Tooltip } from './Tooltip'

type Props = {
  id?: CardId
  size?: 'sm' | 'md' | 'lg'
  legal?: boolean
  selected?: boolean
  dimmed?: boolean
  faceDown?: boolean
  style?: CSSProperties
  className?: string
  badge?: string
  onClick?: () => void
  onDoubleClick?: () => void
  draggablePlay?: boolean
  onPlay?: () => void
  onDiscard?: () => void
}

const CAT_LABEL: Record<CardCategory, string> = {
  [CardCategory.Distance]: 'MILES',
  [CardCategory.Hazard]: 'HAZARD',
  [CardCategory.Remedy]: 'REMEDY',
  [CardCategory.Safety]: 'SAFETY',
}

export function Card({
  id,
  size = 'md',
  legal = false,
  selected = false,
  dimmed = false,
  faceDown = false,
  style,
  className = '',
  badge,
  onClick,
  onDoubleClick,
  draggablePlay,
  onPlay,
  onDiscard,
}: Props) {
  const dragOriginY = useRef(0)

  const def = !faceDown && id !== undefined ? getCard(id) : null
  const visual = !faceDown && id !== undefined ? cardVisual(id) : null

  const body: ReactNode = faceDown || !def || !visual ? (
    <div className="pcard-back" aria-hidden />
  ) : (
    <>
      <div className="pcard-top">
        <span className="pcard-icon">{visual.icon}</span>
        <span className="pcard-cat">{CAT_LABEL[def.category]}</span>
      </div>
      <div className="pcard-name">{def.name}</div>
      <div className="pcard-blurb">{visual.blurb}</div>
      {legal && <span className="pcard-can">PLAY</span>}
      {badge && <span className="pcard-badge">{badge}</span>}
    </>
  )

  const accent = visual?.accent ?? 'blue'

  const onNativeDragStart = (e: DragEvent<HTMLButtonElement>) => {
    dragOriginY.current = e.clientY
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(id ?? ''))
  }

  const onNativeDragEnd = (e: DragEvent<HTMLButtonElement>) => {
    const y = e.clientY
    if (y < window.innerHeight * 0.55) onPlay?.()
    else if (y > window.innerHeight * 0.82) onDiscard?.()
  }

  return (
    <Tooltip
      title={faceDown || !def ? 'Deck' : def.name}
      body={faceDown || !visual ? 'Draw pile.' : `${visual.blurb} ${visual.tip}`}
    >
      <motion.div
        style={{ display: 'inline-flex' }}
        whileHover={dimmed || faceDown ? undefined : { y: -18, scale: 1.06 }}
        whileTap={{ scale: 0.98 }}
        animate={{ scale: selected ? 1.05 : 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      >
        <button
          type="button"
          className={[
            'pcard',
            `pcard-${accent}`,
            `pcard-${size}`,
            legal ? 'is-legal' : '',
            selected ? 'is-selected' : '',
            dimmed ? 'is-dim' : '',
            faceDown ? 'is-back' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          style={style}
          onClick={onClick}
          onDoubleClick={() => {
            onDoubleClick?.()
            onPlay?.()
          }}
          draggable={!!draggablePlay}
          onDragStart={onNativeDragStart}
          onDragEnd={onNativeDragEnd}
        >
          {body}
        </button>
      </motion.div>
    </Tooltip>
  )
}
