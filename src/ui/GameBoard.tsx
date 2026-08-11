import type { ReactNode, CSSProperties } from 'react'
import { MatchPhase } from '../core/cards'
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
  myDraw: boolean
  aiThinking: boolean
  onSelectCard: (i: number) => void
  onPlayIndex: (i: number) => void
  onDiscardIndex: (i: number) => void
  onSelectTarget: (i: number) => void
  onDrawDeck: () => void
  onDrawDiscard: () => void
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
  myDraw,
  aiThinking,
  onSelectCard,
  onPlayIndex,
  onDiscardIndex,
  onSelectTarget,
  onDrawDeck,
  onDrawDiscard,
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

  const drawHint =
    myDraw
      ? 'Double-click Draw or Discard to take a card'
      : state.phase === MatchPhase.AwaitingDraw
        ? `${state.players[state.currentPlayer]!.displayName} is choosing a pile…`
        : null

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

        <div className={`center-piles ${myDraw ? 'is-drawing' : ''}`}>
          <div
            className={`pile ${myDraw && state.drawPile.length ? 'is-hot' : ''}`}
            onDoubleClick={() => {
              if (myDraw && state.drawPile.length) onDrawDeck()
            }}
            title={myDraw ? 'Double-click to draw from the deck' : undefined}
          >
            <Card faceDown size="md" />
            <span className="pile-count">{state.drawPile.length}</span>
            <span className="pile-label">Draw</span>
          </div>
          <div
            className={`pile ${myDraw && discardTop !== undefined ? 'is-hot' : ''}`}
            onDoubleClick={() => {
              if (myDraw && discardTop !== undefined) onDrawDiscard()
            }}
            title={myDraw && discardTop !== undefined ? 'Double-click to take discard' : undefined}
          >
            {discardTop !== undefined ? (
              <Card id={discardTop} size="md" />
            ) : (
              <div className="empty-slot">Discard</div>
            )}
            <span className="pile-count">{state.discardPile.length}</span>
            <span className="pile-label">Discard</span>
          </div>
        </div>
        {drawHint && <p className="draw-hint">{drawHint}</p>}

        <Tableau state={state} playerIndex={localIndex} localIndex={localIndex} />
      </div>

      <HandFan
        hand={me.hand}
        legalIndexes={legalIndexes}
        selected={selected}
        myTurn={myTurn}
        disabled={aiThinking || myDraw}
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
