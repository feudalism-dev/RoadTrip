import { AnimatePresence, motion } from 'framer-motion'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type Toast = { id: number; text: string }

type ToastApi = {
  push: (text: string) => void
}

const ToastCtx = createContext<ToastApi>({ push: () => undefined })

export function useToasts() {
  return useContext(ToastCtx)
}

export function ToastManager({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])

  const push = useCallback((text: string) => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev.slice(-4), { id, text }])
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 2500)
  }, [])

  const api = useMemo(() => ({ push }), [push])

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              className="toast"
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.25 }}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}
