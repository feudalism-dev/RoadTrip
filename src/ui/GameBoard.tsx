import type { ReactNode, CSSProperties } from 'react'
import type { MatchState } from '../core/rules'
import { Card } from './Card'
import { HighwayTracker } from './HighwayTracker'
import { Tableau } from './Tableau'
import { HandFan } from './HandFan'
import { ActionLogDrawer } from './ActionLogDrawer'
import { assets } from './assets'

type Props = {
  state: MatchState
  localIndex: number
  log: string[]
  legalIndexes: Set<number>
  selected: number
  target: number
  myTurn: boolean
  aiThinking: boolean
  onSelectCard: (i: number) => void
  onPlayIndex: (i: number) => void
  onDiscardIndex: (i: number) => void
  onSelectTarget: (i: number) => void
  onMenu: () => void
  coupBanner?: ReactNode
  endOverlay?: ReactNode
}

export function GameBoard({
  state,
  localIndex,
  log,
  legalIndexes,
  selected,
  target,
  myTurn,
  aiThinking,
  onSelectCard,
  onPlayIndex,
  onDiscardIndex,
  onSelectTarget,
  onMenu,
  coupBanner,
  endOverlay,
}: Props) {
  const me = state.players[localIndex]!
  const foes = state.players.map((p, i) => ({ p, i })).filter((x) => x.i !== localIndex)
  const discardTop = state.discardPile[state.discardPile.length - 1]
  const boardStyle = {
    '--asset-felt': `url(${assets.felt})`,
    '--asset-wood': `url(${assets.wood})`,
    '--asset-highway': `url(${assets.highway})`,
    '--asset-card-back': `url(${assets.cardBack})`,
  } as CSSProperties

  return (
    <div className="table-root" style={boardStyle}>
      <div className="table-felt" />
      <div className="table-wood-edge" />

      <header className="board-top">
        <div className="brand-mark">
          <span>ROAD TRIP</span>
          <small>Tabletop Race</small>
        </div>
        <HighwayTracker state={state} localIndex={localIndex} />
        <button type="button" className="ghost-btn" onClick={onMenu}>
          Menu
        </button>
      </header>

      <div className="board-mid">
        <div className="foe-row">
          {foes.map(({ i }) => (
            <Tableau
              key={i}
              state={state}
              playerIndex={i}
              localIndex={localIndex}
              selectedAsTarget={target === i}
              onSelectTarget={() => onSelectTarget(i)}
            />
          ))}
        </div>

        <div className="center-piles">
          <div className="pile">
            <Card faceDown size="md" />
            <span className="pile-count">{state.drawPile.length}</span>
            <span className="pile-label">Draw</span>
          </div>
          <div className="pile">
            {discardTop !== undefined ? (
              <Card id={discardTop} size="md" />
            ) : (
              <div className="empty-slot">Discard</div>
            )}
            <span className="pile-count">{state.discardPile.length}</span>
            <span className="pile-label">Discard</span>
          </div>
        </div>

        <Tableau state={state} playerIndex={localIndex} localIndex={localIndex} />
      </div>

      <HandFan
        hand={me.hand}
        legalIndexes={legalIndexes}
        selected={selected}
        myTurn={myTurn}
        disabled={aiThinking}
        onSelect={onSelectCard}
        onPlay={onPlayIndex}
        onDiscard={onDiscardIndex}
      />

      <ActionLogDrawer lines={log} />
      {coupBanner}
      {endOverlay}
    </div>
  )
}
