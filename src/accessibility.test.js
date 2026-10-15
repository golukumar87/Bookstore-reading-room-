import React, { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AccessibilityProvider, useAccessibility } from './accessibility'

function AccessibilityProbe() {
  const { language, setLanguage, highContrast, setHighContrast, textSize, setTextSize, t } = useAccessibility()

  return createElement('div', null,
    createElement('span', null, language),
    createElement('button', { type: 'button', onClick: () => setLanguage(language === 'en' ? 'hi' : 'en') }, t('Home')),
    createElement('button', { type: 'button', onClick: () => setHighContrast(!highContrast) }, t('High contrast')),
    createElement('button', { type: 'button', onClick: () => setTextSize(Math.min(1.2, textSize + 0.1)) }, t('Increase interface text size'))
  )
}

describe('accessibility preferences', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('high-contrast')
    document.documentElement.style.removeProperty('--accessibility-zoom')
  })

  afterEach(cleanup)

  it('translates the interface and persists language, contrast, and text-size choices', () => {
    render(createElement(AccessibilityProvider, null, createElement(AccessibilityProbe)))

    fireEvent.click(screen.getByRole('button', { name: 'Home' }))
    expect(screen.getByText('hi')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'मुखपृष्ठ' })).toBeTruthy()
    expect(document.documentElement.lang).toBe('hi')
    expect(localStorage.getItem('bookstore:accessibility:language')).toBe('hi')

    fireEvent.click(screen.getByRole('button', { name: 'हाई कॉन्ट्रास्ट' }))
    expect(document.documentElement.classList.contains('high-contrast')).toBe(true)
    expect(localStorage.getItem('bookstore:accessibility:high-contrast')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'इंटरफ़ेस के अक्षर बड़े करें' }))
    expect(document.documentElement.style.getPropertyValue('--accessibility-zoom')).toBe('1.1')
    expect(localStorage.getItem('bookstore:accessibility:text-size')).toBe('1.1')
  })
})
