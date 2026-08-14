import { useState, type ReactNode } from 'react'

type Page = {
  kicker: string
  title: string
  body: ReactNode
}

const PAGES: Page[] = [
  {
    kicker: '1 / 6',
    title: 'The race',
    body: (
      <>
        <p>
          First driver to exactly <strong>1000 miles</strong> wins. You cannot overshoot — if 75 would
          put you at 1025, that card is illegal.
        </p>
        <ul>
          <li>2–4 drivers (you + computers, or friends at a Second Life table).</li>
          <li>Green mile cards: 25, 50, 75, 100, 200.</li>
          <li>At most <strong>two 200-mile</strong> cards in the whole race.</li>
        </ul>
      </>
    ),
  },
  {
    kicker: '2 / 6',
    title: 'Your turn',
    body: (
      <>
        <p>Each turn has two steps:</p>
        <ol>
          <li>
            <strong>Draw</strong> one card — tap Draw or the face-up Discard. Empty discard auto-draws
            from the deck.
          </li>
          <li>
            <strong>Play</strong> one card, or <strong>Discard</strong> one you cannot use.
          </li>
        </ol>
        <p className="muted">Hand size returns to 6. Glowing cards are legal right now.</p>
      </>
    ),
  },
  {
    kicker: '3 / 6',
    title: 'Get moving',
    body: (
      <>
        <p>
          You cannot play miles until you are <strong>Driving</strong>. Play <strong>Drive (GO)</strong>{' '}
          first from an empty battle pile.
        </p>
        <p>
          After that, a matching battle remedy (Repairs, Gasoline, Spare Tire, Traffic Clear, Nav Fix)
          clears the hazard <em>and</em> puts you back on the road — no second Drive needed.
        </p>
        <p className="muted">Red Light is the exception: only Drive (or Emergency Vehicle) clears it.</p>
      </>
    ),
  },
  {
    kicker: '4 / 6',
    title: 'Hazards & fixes',
    body: (
      <>
        <p>Red cards hit an opponent who is moving. You need the matching amber fix:</p>
        <table className="help-pairs">
          <thead>
            <tr>
              <th>Hazard</th>
              <th>Remedy</th>
              <th>Safety</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Red Light</td>
              <td>Drive</td>
              <td>Emergency Vehicle</td>
            </tr>
            <tr>
              <td>Accident</td>
              <td>Repairs</td>
              <td>Driving Ace</td>
            </tr>
            <tr>
              <td>Out of Gas</td>
              <td>Gasoline</td>
              <td>Extra Tank</td>
            </tr>
            <tr>
              <td>Flat Tire</td>
              <td>Spare Tire</td>
              <td>Puncture-Proof</td>
            </tr>
            <tr>
              <td>Speed Limit</td>
              <td>End of Limit</td>
              <td>Emergency Vehicle</td>
            </tr>
            <tr>
              <td>Traffic Jam</td>
              <td>Traffic Clear</td>
              <td>Fast Lane</td>
            </tr>
            <tr>
              <td>GPS Error</td>
              <td>Nav Fix</td>
              <td>GPS Lock</td>
            </tr>
          </tbody>
        </table>
        <p className="muted">
          Speed Limit does not stop you — it only allows 25 and 50 mile cards. If a stop hazard lasts 5 of
          your turns, you may call the Auto Club (pay miles for a tow). A new hazard starts that count over.
        </p>
      </>
    ),
  },
  {
    kicker: '5 / 6',
    title: 'Safeties & Counter Attack',
    body: (
      <>
        <p>
          Blue safeties are permanent immunity. Playing one also grants an <strong>extra turn</strong>.
        </p>
        <p>
          If you are hit and you hold the matching safety, play it immediately as a{' '}
          <strong>Counter Attack</strong>: the hazard is thrown away, everyone else is skipped, and you
          take a full turn.
        </p>
        <p className="muted">Emergency Vehicle also blocks Speed Limit and lets you roll without Drive when clear.</p>
      </>
    ),
  },
  {
    kicker: '6 / 6',
    title: 'How to play cards',
    body: (
      <>
        <ul>
          <li>
            <strong>Tap</strong> a glowing card, then tap <strong>Play</strong> — or double-tap it.
          </li>
          <li>
            <strong>Slide up</strong> to play, <strong>slide down</strong> to discard.
          </li>
          <li>
            Hazards: slide onto an opponent’s tableau, or tap them first then Play.
          </li>
          <li>
            Use <strong>UI size</strong> in the top bar if the HUD is too big or too small.
          </li>
        </ul>
        <p className="muted">
          Solo vs computer works in any browser (this site). Multiplayer is only at a Road Trip table
          in Second Life — sit, then Create or Join. A seated HUD always drives the table.
        </p>
      </>
    ),
  },
]

type HowToPlayProps = {
  onClose?: () => void
  closeLabel?: string
}

export function HowToPlay({ onClose, closeLabel = 'Close' }: HowToPlayProps) {
  const [page, setPage] = useState(0)
  const cur = PAGES[page]!
  const last = page >= PAGES.length - 1

  return (
    <div className="help-book">
      <p className="brand-kicker">{cur.kicker} · How to play</p>
      <h2>{cur.title}</h2>
      <div className="help-body">{cur.body}</div>
      <div className="help-pager">
        <button
          type="button"
          className="btn ghost"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          Back
        </button>
        <span className="help-dots" aria-hidden>
          {PAGES.map((_, i) => (
            <button
              key={i}
              type="button"
              className={i === page ? 'help-dot is-on' : 'help-dot'}
              onClick={() => setPage(i)}
              aria-label={`Page ${i + 1}`}
            />
          ))}
        </span>
        {last ? (
          <button type="button" className="btn primary" onClick={() => onClose?.()}>
            {closeLabel}
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        )}
      </div>
    </div>
  )
}

type OverlayProps = {
  open: boolean
  onClose: () => void
}

export function HowToPlayOverlay({ open, onClose }: OverlayProps) {
  if (!open) return null
  return (
    <div
      className="help-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="How to play"
      onClick={onClose}
    >
      <div
        className="help-sheet"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <HowToPlay onClose={onClose} closeLabel="Got it" />
        <button type="button" className="help-x" onClick={onClose} aria-label="Close help">
          ×
        </button>
      </div>
    </div>
  )
}
