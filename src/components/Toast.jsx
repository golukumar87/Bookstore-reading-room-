import React from 'react'
import { useAccessibility } from '../accessibility'

function Toast({ title, message, variant = 'info', actionLabel, onAction, onClose }) {
  const { t } = useAccessibility()
  return (
    <div className={`toast toast-${variant}`} role="status" aria-live="polite">
      <div className="toast-left">{variant === 'success' ? '✅' : variant === 'error' ? '⚠️' : 'ℹ️'}</div>
      <div className="toast-mid">
        <div className="toast-title">{t(title)}</div>
        {message ? <div className="toast-message">{t(message)}</div> : null}
      </div>
      {actionLabel && (
        <button
          className="toast-action"
          type="button"
          onClick={() => {
            onAction?.()
            onClose?.()
          }}
        >
          {t(actionLabel)}
        </button>
      )}
      <button className="toast-close" onClick={onClose} aria-label={t('close toast')} type="button">
        ✕
      </button>
    </div>
  )
}

export default Toast
