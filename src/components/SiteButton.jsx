import React from 'react'

function SiteButton({ className = '', children, ...props }) {
  return (
    <button className={className} type="button" {...props}>
      {children}
    </button>
  )
}

export default SiteButton

