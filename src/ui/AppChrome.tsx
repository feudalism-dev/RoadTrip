import { useEffect, useState } from 'react'
import type { SlBootstrap } from '../sl/bootstrap'
import { openSeatedBrowser } from '../sl/sessionUrl'
import { applyUiScale, clampUiScale, defaultUiScale, UI_SCALE_MAX, UI_SCALE_MIN, UI_SCALE_STEP } from './uiScale'

type Props = {
  slBoot: SlBootstrap | null
  parked?: boolean
  roomCode?: string
  onStatus?: (msg: string) => void
}

export function AppChrome({ slBoot, parked, roomCode, onStatus }: Props) {
  const [scale, setScale] = useState(() => defaultUiScale())
  const seated = Boolean(slBoot && slBoot.slCap && !parked)
  const alreadyBrowser = slBoot?.client === 'browser'

  useEffect(() => {
    applyUiScale(scale)
  }, [scale])

  const bump = (delta: number) => {
    setScale((s) => clampUiScale(s + delta))
  }

  return (
    <div className="app-chrome" role="toolbar" aria-label="Display controls">
      <div className="scale-control">
        <span className="scale-label">UI size</span>
        <button type="button" className="scale-btn" onClick={() => bump(-UI_SCALE_STEP)} aria-label="Smaller UI">
          −
        </button>
        <input
          className="scale-slider"
          type="range"
          min={UI_SCALE_MIN}
          max={UI_SCALE_MAX}
          step={UI_SCALE_STEP}
          value={scale}
          onChange={(e) => setScale(clampUiScale(Number(e.target.value)))}
          aria-label="UI scale"
        />
        <button type="button" className="scale-btn" onClick={() => bump(UI_SCALE_STEP)} aria-label="Larger UI">
          +
        </button>
        <span className="scale-pct">{Math.round(scale * 100)}%</span>
      </div>
      {seated && !alreadyBrowser && (
        <button
          type="button"
          className="chrome-browser-btn"
          title="Open a real browser — solo vs computer works with or without the table; multiplayer stays at this table"
          onClick={() => {
            void openSeatedBrowser(slBoot!, roomCode).then((how) => {
              onStatus?.(
                how === 'opened'
                  ? 'Opened in your browser. You can close this HUD media.'
                  : 'Copied the table link. Confirm the Second Life dialog to open your browser — this HUD will park.',
              )
            })
          }}
        >
          Play in Browser
        </button>
      )}
      {alreadyBrowser && slBoot && (
        <span className="chrome-note">Browser table · seat {(slBoot.seat >= 0 ? slBoot.seat : 0) + 1}</span>
      )}
    </div>
  )
}
