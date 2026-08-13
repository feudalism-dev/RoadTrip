import type { ReactNode, CSSProperties } from 'react'
import { MatchPhase } from '../core/cards'
import type { MatchState } from '../core/rules'
import { Card } from './Card'
import { HighwayTracker } from './HighwayTracker'
import { Tableau } from './Tableau'
import { HandFan } from './HandFan'
import { ActionLogDrawer } from './ActionLogDrawer'
import { assets } from './assets'
import { whatShouldIDo } from './gameHelpers'

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
  onPlayIndex: (i: number, opts?: { dropPlayerIndex?: number }) => void
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
  const selectedLegal = selected >= 0 && legalIndexes.has(selected)
  const coach = whatShouldIDo(state, localIndex)
  const boardStyle = {
    '--asset-felt': `url(${assets.felt})`,
    '--asset-wood': `url(${assets.wood})`,
    '--asset-highway': `url(${assets.highway})`,
    '--asset-card-back': `url(${assets.cardBack})`,
  } as CSSProperties

  const drawHint =
    myDraw
      ? 'Tap Draw or Discard below — or tap the piles'
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
          <small>1000-mile race</small>
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

        <div className={`center-zone ${myDraw ? 'is-drawing' : ''}`}>
          <div className="center-piles">
            <div
              className={`pile ${myDraw && state.drawPile.length ? 'is-hot' : ''}`}
              onClick={() => {
                if (myDraw && state.drawPile.length) onDrawDeck()
              }}
              onDoubleClick={() => {
                if (myDraw && state.drawPile.length) onDrawDeck()
              }}
              title={myDraw ? 'Tap to draw from the deck' : undefined}
            >
              <Card faceDown size="md" />
              <span className="pile-count">{state.drawPile.length}</span>
              <span className="pile-label">Draw</span>
            </div>
            <div
              className={`pile ${myDraw && discardTop !== undefined ? 'is-hot' : ''}`}
              onClick={() => {
                if (myDraw && discardTop !== undefined) onDrawDiscard()
              }}
              onDoubleClick={() => {
                if (myDraw && discardTop !== undefined) onDrawDiscard()
              }}
              title={myDraw && discardTop !== undefined ? 'Tap to take the discard' : undefined}
            >
              {discardTop !== undefined ? (
                <Card id={discardTop} size="md" />
              ) : (
                <div className="empty-slot md">Discard</div>
              )}
              <span className="pile-count">{state.discardPile.length}</span>
              <span className="pile-label">Discard</span>
            </div>
          </div>
          <p className={`draw-hint ${drawHint ? '' : 'is-empty'}`}>{drawHint ?? '\u00a0'}</p>
        </div>

        <Tableau state={state} playerIndex={localIndex} localIndex={localIndex} />
      </div>

      <div className="play-dock">
        <p className="play-coach">{coach}</p>
        <div className="play-actions">
          {myDraw && (
            <>
              <button
                type="button"
                className="btn primary"
                disabled={!state.drawPile.length}
                onClick={onDrawDeck}
              >
                Draw deck
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={discardTop === undefined}
                onClick={onDrawDiscard}
              >
                Take discard
              </button>
            </>
          )}
          {myTurn && selected >= 0 && (
            <>
              <button
                type="button"
                className="btn primary"
                disabled={!selectedLegal}
                onClick={() => onPlayIndex(selected)}
              >
                Play card
              </button>
              <button type="button" className="btn ghost" onClick={() => onDiscardIndex(selected)}>
                Discard
              </button>
            </>
          )}
          {myTurn && selected < 0 && (
            <span className="play-nudge">Tap a glowing card, then Play — or slide it</span>
          )}
        </div>
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
