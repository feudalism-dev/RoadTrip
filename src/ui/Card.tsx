import { motion } from 'framer-motion'
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import type { CardId } from '../core/cards'
import { CardCategory, getCard } from '../core/cards'
import { cardFaceUrl } from './assets'
import { cardVisual } from './cardMeta'
import { playerIndexAtPoint } from './gameHelpers'
import { Tooltip } from './Tooltip'

export type PlayGestureOpts = {
  /** Opponent under the pointer when the slide ended (hazard targeting). */
  dropPlayerIndex?: number
}

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
  /** Enable pointer slide: up = play, down = discard (CEF-safe; avoids HTML5 DnD). */
  draggablePlay?: boolean
  onPlay?: (opts?: PlayGestureOpts) => void
  onDiscard?: () => void
}

const CAT_LABEL: Record<CardCategory, string> = {
  [CardCategory.Distance]: 'MILES',
  [CardCategory.Hazard]: 'HAZARD',
  [CardCategory.Remedy]: 'REMEDY',
  [CardCategory.Safety]: 'SAFETY',
}

/** Vertical slide thresholds (px). CEF/MOAP often breaks HTML5 dragend coordinates. */
const SLIDE_PLAY_PX = -48
const SLIDE_DISCARD_PX = 56

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
  const pointerId = useRef<number | null>(null)
  const originY = useRef(0)
  const originX = useRef(0)
  const sliding = useRef(false)

  const def = !faceDown && id !== undefined ? getCard(id) : null
  const visual = !faceDown && id !== undefined ? cardVisual(id) : null
  const faceSrc = !faceDown && id !== undefined ? cardFaceUrl(id) : null
  const [faceFailed, setFaceFailed] = useState(false)
  const artOn = Boolean(faceSrc) && !faceFailed

  useEffect(() => {
    setFaceFailed(false)
  }, [faceSrc])

  const body: ReactNode = faceDown || !def || !visual ? (
    <div className="pcard-back" aria-hidden />
  ) : (
    <>
      {faceSrc && (
        <img
          className={artOn ? 'pcard-art is-on' : 'pcard-art'}
          src={faceSrc}
          alt=""
          draggable={false}
          onError={() => setFaceFailed(true)}
        />
      )}
      {!artOn && (
        <>
          <div className="pcard-top">
            <span className="pcard-icon">{visual.icon}</span>
            <span className="pcard-cat">{CAT_LABEL[def.category]}</span>
          </div>
          <div className="pcard-name">{def.name}</div>
          <div className="pcard-blurb">{visual.blurb}</div>
        </>
      )}
      {legal && <span className="pcard-can">PLAY</span>}
      {badge && <span className="pcard-badge">{badge}</span>}
    </>
  )

  const accent = visual?.accent ?? 'blue'

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (!draggablePlay) return
    if (e.button !== 0) return
    pointerId.current = e.pointerId
    originY.current = e.clientY
    originX.current = e.clientX
    sliding.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const finishSlide = (e: PointerEvent<HTMLButtonElement>) => {
    if (!sliding.current || pointerId.current !== e.pointerId) return
    sliding.current = false
    pointerId.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }

    const dy = e.clientY - originY.current
    const dx = e.clientX - originX.current
    const moved = Math.abs(dy) >= 24 || Math.abs(dx) >= 24

    // Dropped on a player tableau → play targeting that seat (hazards).
    if (moved) {
      const drop = playerIndexAtPoint(e.clientX, e.clientY)
      if (drop != null) {
        onPlay?.({ dropPlayerIndex: drop })
        return
      }
    }

    // Ignore mostly-horizontal / tiny taps (click / double-click still fire).
    if (Math.abs(dy) < 28 || Math.abs(dx) > Math.abs(dy) * 1.4) return
    if (dy <= SLIDE_PLAY_PX) onPlay?.()
    else if (dy >= SLIDE_DISCARD_PX) onDiscard?.()
  }

  return (
    <Tooltip
      title={faceDown || !def ? 'Deck' : def.name}
      body={faceDown || !visual ? 'Draw pile.' : `${visual.blurb} ${visual.tip}`}
    >
      <motion.div
        style={{ display: 'inline-flex', touchAction: draggablePlay ? 'none' : undefined }}
        whileHover={dimmed || faceDown ? undefined : { y: -10, scale: 1.04 }}
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
            artOn ? 'has-art' : '',
            draggablePlay ? 'is-slideable' : '',
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
          onPointerDown={onPointerDown}
          onPointerUp={finishSlide}
          onPointerCancel={() => {
            sliding.current = false
            pointerId.current = null
          }}
        >
          {body}
        </button>
      </motion.div>
    </Tooltip>
  )
}
