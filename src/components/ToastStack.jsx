import React, { useEffect } from 'react'
import Toast from './Toast'

function ToastStack({ toasts, onDismiss }) {
  useEffect(() => {
    if (!toasts.length) return
    const timers = toasts.map((t) =>
      setTimeout(() => {
        onDismiss?.(t.id)
      }, t.duration ?? 2800)
    )
    return () => timers.forEach((id) => clearTimeout(id))
  }, [toasts, onDismiss])

  



  if (!toasts.length) return null

  return (
    <div className="toast-stack" aria-label="notifications">
      {toasts.map((t) => (
        <Toast
          key={t.id}
          title={t.title}
          message={t.message}
          variant={t.variant}
          actionLabel={t.actionLabel}
          onAction={t.onAction}
          onClose={() => onDismiss?.(t.id)}
        />
      ))}
    </div>
  )
}

export default ToastStack
