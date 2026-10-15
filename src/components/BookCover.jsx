import React, { useEffect, useState } from 'react'

function escapeXml(value = '') {
  return value.replace(/[<>&'"]/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  })[character])
}

function createFallbackCover(title, author) {
  const safeTitle = escapeXml(title || 'BookStore')
  const safeAuthor = escapeXml(author || 'BookStore')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="720" viewBox="0 0 480 720"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#273c75"/><stop offset="1" stop-color="#6c5ce7"/></linearGradient></defs><rect width="480" height="720" fill="url(#g)"/><rect x="24" y="24" width="432" height="672" rx="14" fill="none" stroke="#f5d76e" stroke-width="4"/><path d="M64 176h352M64 554h352" stroke="#f5d76e" stroke-width="3" opacity=".8"/><text x="240" y="245" text-anchor="middle" fill="#fff" font-family="Georgia,serif" font-size="36" font-weight="bold">${safeTitle}</text><text x="240" y="604" text-anchor="middle" fill="#f5d76e" font-family="Arial,sans-serif" font-size="22">${safeAuthor}</text><text x="240" y="650" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="16" letter-spacing="5">BOOKSTORE</text></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function BookCover({ src, title, author, alt, ...imageProps }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  return (
    <img
      {...imageProps}
      src={failed ? createFallbackCover(title, author) : src}
      alt={alt || title || 'Book cover'}
      onError={() => {
        if (!failed) setFailed(true)
      }}
    />
  )
}

export default BookCover
