import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

type Props = {
  lines: string[]
}

export function ActionLogDrawer({ lines }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`log-drawer ${open ? 'open' : ''}`}>
      <button type="button" className="log-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide log' : 'Game log'}
      </button>
      <AnimatePresence>
        {open && (
          <motion.aside
            className="log-panel-board"
            initial={{ x: 280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 280, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <h4>Action Log</h4>
            <ol>
              {lines.map((line, i) => (
                <li key={`${i}-${line.slice(0, 20)}`} className={i === 0 ? 'latest' : ''}>
                  {line}
                </li>
              ))}
            </ol>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  )
}
