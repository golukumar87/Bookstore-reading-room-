import React, { useEffect } from 'react'
import { FaTimes } from 'react-icons/fa'
import BookCover from './BookCover'

function ImagePreviewModal({ image, title, onClose }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  if (!image) return null

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) onClose?.()
      }}
    >
      <div className="modal modal-image-modal" role="dialog" aria-modal="true" aria-label="image preview">
        <button className="modal-close" onClick={onClose} aria-label="close" type="button">
          <FaTimes />
        </button>

        <div className="image-preview-body">
          <div className="image-preview-card" role="group" aria-label="preview content">
            <BookCover
              className="image-preview-img"
              src={image}
              title={title}
              loading="lazy"
            />

            {/* small mock metadata so UI looks like details */}
            {title ? (
              <div className="image-preview-meta">
                <div className="image-preview-title">{title}</div>
                <div className="image-preview-sub">★ 4.6 (120 reviews) • Order in 2 days</div>
                <div className="image-preview-actions">
                  <button className="btn-primary-large" type="button" onClick={onClose}>
                    Buy now
                  </button>
                  <button className="btn-secondary-large" type="button" onClick={onClose}>
                    Add to cart
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImagePreviewModal
