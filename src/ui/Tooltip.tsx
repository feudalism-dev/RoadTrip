import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

type Props = {
  title: string
  body: string
  children: ReactNode
}

export function Tooltip({ title, body, children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <span
      className="tip-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            className="tip-pop"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            role="tooltip"
          >
            <strong>{title}</strong>
            <p>{body}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  )
}
