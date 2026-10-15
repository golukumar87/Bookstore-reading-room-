import React from 'react'

function BookSkeletonGrid({ count = 8 }) {
  return (
    <div className="book-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div className="book-card skeleton" key={i}>
          <div className="book-image skeleton-img" />
          <div className="book-details skeleton-body">
            <div className="sk-line w-80" />
            <div className="sk-line w-60" />
            <div className="sk-line w-50" />
            <div className="sk-line w-40" />
            <div className="sk-line w-90" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default BookSkeletonGrid

