import { motion } from 'framer-motion'
import type { MatchState } from '../core/rules'
import { assets } from './assets'

type Props = {
  state: MatchState
  localIndex: number
}

export function HighwayTracker({ state, localIndex }: Props) {
  const goal = state.config.goalMiles

  return (
    <div className="highway" aria-label="Race progress">
      <div className="highway-road">
        <div className="highway-lane" />
        <div className="highway-finish">
          <span>FINISH</span>
          <small>1000</small>
        </div>
        {state.players.map((p, i) => {
          const pct = Math.min(100, (p.miles / goal) * 100)
          const mine = i === localIndex
          const src = mine ? assets.carPlayer : assets.carOpponent
          return (
            <motion.div
              key={i}
              className={`highway-car ${mine ? 'mine' : 'foe'} ${state.currentPlayer === i ? 'active' : ''}`}
              animate={{ left: `calc(${pct}% - 22px)` }}
              transition={{ type: 'spring', stiffness: 80, damping: 18 }}
              title={`${p.displayName}: ${p.miles} mi`}
            >
              <img className="car-sprite" src={src} alt="" draggable={false} />
              <span className="car-label">{mine ? 'YOU' : p.displayName.split(' ')[0]}</span>
            </motion.div>
          )
        })}
      </div>
      <div className="highway-scale">
        <span>0</span>
        <span>250</span>
        <span>500</span>
        <span>750</span>
        <span>1000</span>
      </div>
    </div>
  )
}
