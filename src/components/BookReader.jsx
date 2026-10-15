import React, { useEffect, useRef, useState } from 'react'
import { FaArrowLeft, FaArrowRight, FaBookOpen, FaMinus, FaPause, FaPlay, FaPlus, FaShoppingBag, FaStop, FaVolumeUp } from 'react-icons/fa'
import BookCover from './BookCover'
import { api } from '../api'
import { useAccessibility } from '../accessibility'
import {
  emptyReaderState,
  getSelectedParagraph,
  mergeReaderStates,
  normalizeReaderState,
  readLocalReaderState,
  writeLocalReaderState
} from '../readerState'

const MIN_FONT_SIZE = 16
const MAX_FONT_SIZE = 25

function extractBookText(rawText, textFormat) {
  const normalized = rawText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  if (textFormat === 'plain') return normalized.trim()

  const startMarker = /^\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK\b.*\*{3}\s*$/im
  const endMarker = /^\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK\b.*\*{3}\s*$/im
  const start = startMarker.exec(normalized)
  if (!start) throw new Error('The book text does not contain its expected source marker.')
  const contentStart = start.index + start[0].length
  const remainingText = normalized.slice(contentStart)
  const end = endMarker.exec(remainingText)
  if (!end) throw new Error('The book text is incomplete: its source end marker is missing.')
  return remainingText.slice(0, end.index).trim()
}

function isSectionHeading(paragraph) {
  return paragraph.length < 150 && (
    /^(?:chapter|book|canto)\s+(?:[ivxlcdm]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen)\b/i.test(paragraph) ||
    /^[ivxlcdm]+\.\s+[A-Z][A-Z\s’'—:;,-]{3,}$/.test(paragraph)
  )
}

function makeSections(bookText) {
  const paragraphs = bookText
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)

  const headings = paragraphs.filter(isSectionHeading).length
  if (headings >= 2) {
    const sections = []
    let current = { title: 'Opening pages', paragraphs: [] }
    paragraphs.forEach((paragraph) => {
      if (isSectionHeading(paragraph)) {
        if (current.paragraphs.length) sections.push(current)
        current = { title: paragraph, paragraphs: [] }
      } else {
        current.paragraphs.push(paragraph)
      }
    })
    if (current.paragraphs.length) sections.push(current)
    return sections
  }

  const pages = []
  let current = []
  let pageLength = 0
  paragraphs.forEach((paragraph) => {
    if (pageLength >= 4500 && current.length) {
      pages.push(current)
      current = []
      pageLength = 0
    }
    current.push(paragraph)
    pageLength += paragraph.length
  })
  if (current.length) pages.push(current)
  return pages.map((page, index) => ({ title: `Reading page ${index + 1}`, paragraphs: page }))
}

function splitSpeechParagraph(text, paragraphIndex, maxLength = 220) {
  const chunks = []
  const words = [...text.matchAll(/\S+/g)]
  let start = null
  let end = null
  words.forEach((word) => {
    const wordStart = word.index
    const wordEnd = wordStart + word[0].length
    if (word[0].length > maxLength) {
      if (start !== null) chunks.push({ text: text.slice(start, end), paragraphIndex, startOffset: start })
      start = null
      for (let index = wordStart; index < wordEnd; index += maxLength) {
        chunks.push({
          text: text.slice(index, Math.min(index + maxLength, wordEnd)),
          paragraphIndex,
          startOffset: index
        })
      }
      return
    }
    if (start !== null && wordEnd - start > maxLength) {
      chunks.push({ text: text.slice(start, end), paragraphIndex, startOffset: start })
      start = wordStart
    } else {
      if (start === null) start = wordStart
    }
    end = wordEnd
  })
  if (start !== null) chunks.push({ text: text.slice(start, end), paragraphIndex, startOffset: start })
  return chunks
}

function getSentenceRange(text, index) {
  const sentences = /[^.!?।]+(?:[.!?।]+["'”’)]*)?|[.!?।]+/gu
  for (const sentence of text.matchAll(sentences)) {
    const start = sentence.index + (sentence[0].match(/^\s*/u)?.[0].length || 0)
    const end = sentence.index + sentence[0].length - (sentence[0].match(/\s*$/u)?.[0].length || 0)
    if (index >= start && index < end) return { start, end }
  }
  return { start: 0, end: text.length }
}

function renderParagraphText(text, highlights, speechRange) {
  const boundaries = new Set([0, text.length])
  highlights.forEach(({ startOffset, endOffset }) => {
    boundaries.add(Math.max(0, Math.min(text.length, startOffset)))
    boundaries.add(Math.max(0, Math.min(text.length, endOffset)))
  })
  if (speechRange) {
    boundaries.add(Math.max(0, Math.min(text.length, speechRange.start)))
    boundaries.add(Math.max(0, Math.min(text.length, speechRange.end)))
  }
  const sortedBoundaries = [...boundaries].sort((first, second) => first - second)
  return sortedBoundaries.slice(0, -1).map((start, index) => {
    const end = sortedBoundaries[index + 1]
    if (end <= start) return null
    const highlight = highlights.find((mark) => mark.startOffset <= start && mark.endOffset >= end)
    const isSpeaking = speechRange && speechRange.start < end && speechRange.end > start
    const classes = [
      highlight ? `reader-highlight highlight-${highlight.color || 'yellow'}` : '',
      isSpeaking ? 'reader-speech-highlight' : ''
    ].filter(Boolean).join(' ')
    const content = text.slice(start, end)
    return classes
      ? <mark className={classes} key={`${start}-${end}`}>{content}</mark>
      : <React.Fragment key={`${start}-${end}`}>{content}</React.Fragment>
  })
}

function extractWikiText(html) {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  parsed.querySelectorAll('.mw-editsection, .noprint, .metadata, .toc, .navbox, .portal, .catlinks, table, script, style, sup.reference').forEach((element) => element.remove())
  const content = parsed.querySelector('#mw-content-text .mw-parser-output, .mw-parser-output') || parsed.body
  const blockElements = new Set(['P', 'DIV', 'SECTION', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BR', 'BLOCKQUOTE'])
  const textOf = (node) => Array.from(node.childNodes).map((child) => {
    if (child.nodeType === Node.TEXT_NODE) return child.textContent
    const text = textOf(child)
    return blockElements.has(child.nodeName) ? `\n${text}\n` : text
  }).join('')
  return textOf(content)
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function BookReader({ book, reader, onBack, onBuy, authUser }) {
  const { t } = useAccessibility()
  const sourceName = reader.sourceName || 'Project Gutenberg'
  const accountScope = authUser?.id ? String(authUser.id) : 'guest'
  const [sections, setSections] = useState([])
  const [currentSection, setCurrentSection] = useState(0)
  const [fontSize, setFontSize] = useState(19)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [readerState, setReaderState] = useState(emptyReaderState)
  const [stateReady, setStateReady] = useState(false)
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false)
  const [syncStatus, setSyncStatus] = useState('')
  const [selection, setSelection] = useState(null)
  const [speechVoices, setSpeechVoices] = useState([])
  const [speechVoice, setSpeechVoice] = useState('')
  const [speechRate, setSpeechRate] = useState(1)
  const [speechStatus, setSpeechStatus] = useState('idle')
  const [speechMessage, setSpeechMessage] = useState('')
  const [speechParagraphIndex, setSpeechParagraphIndex] = useState(null)
  const [speechSentenceRange, setSpeechSentenceRange] = useState(null)
  const readerPageRef = useRef(null)
  const speechSessionRef = useRef(0)
  const speechProgressRef = useRef(0)

  useEffect(() => {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return undefined
    const synthesis = window.speechSynthesis
    const updateVoices = () => setSpeechVoices(synthesis.getVoices())
    updateVoices()
    synthesis.addEventListener('voiceschanged', updateVoices)
    return () => synthesis.removeEventListener('voiceschanged', updateVoices)
  }, [])

  useEffect(() => {
    speechSessionRef.current += 1
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeechStatus('idle')
    setSpeechMessage('')
    setSpeechParagraphIndex(null)
    setSpeechSentenceRange(null)
  }, [currentSection])

  useEffect(() => () => {
    speechSessionRef.current += 1
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setStateReady(false)
    setCloudSyncEnabled(false)
    setSyncStatus('')
    setError('')
    setSections([])
    const loadEdition = reader.textFile
      ? fetch(`/reader/${encodeURIComponent(reader.textFile)}`).then((response) => {
        if (!response.ok) throw new Error(`Book text could not be loaded (${response.status}).`)
        return response.text().then((text) => ({
          text: reader.textFormat === 'plain' ? text : extractBookText(text, reader.textFormat),
          textFormat: 'plain'
        }))
      })
      : api(`/reading/${encodeURIComponent(book.id)}/text`)
    loadEdition
      .then(({ text, textFormat }) => {
        const readableText = textFormat === 'html' ? extractWikiText(text) : text
        const parsedSections = makeSections(textFormat === 'gutenberg' ? extractBookText(readableText, textFormat) : readableText)
        if (!parsedSections.length) throw new Error('No readable pages were found in the book text.')
        return { parsedSections }
      })
      .then(async (text) => {
        const { parsedSections } = text
        const localState = readLocalReaderState(book.id, accountScope)
        let initialState = localState
        let canSync = false
        if (authUser?.id) {
          try {
            const response = await api(`/reading/${encodeURIComponent(book.id)}`)
            initialState = mergeReaderStates(localState, response.state || emptyReaderState())
            canSync = true
          } catch (loadError) {
            console.error('Could not load account reading progress:', loadError)
          }
        }
        if (!cancelled) {
          const safeState = normalizeReaderState(initialState)
          const restoredSection = Math.min(safeState.position, parsedSections.length - 1)
          setSections(parsedSections)
          setReaderState({
            ...safeState,
            position: restoredSection,
            paragraphPosition: Math.min(safeState.paragraphPosition, parsedSections[restoredSection].paragraphs.length)
          })
          setCurrentSection(restoredSection)
          setCloudSyncEnabled(canSync)
          setSyncStatus(authUser?.id && !canSync
            ? 'Account sync is unavailable; this session is saved on this device only.'
            : authUser?.id ? 'Progress synced with your account.' : 'Progress saved on this device.')
          setStateReady(true)
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || 'Book could not be loaded. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [book.id, reader.textFile, reader.textFormat, accountScope, authUser?.id])

  useEffect(() => {
    if (!stateReady || !sections.length) return
    const nextState = normalizeReaderState({
      ...readerState,
      position: currentSection,
      paragraphPosition: readerState.position === currentSection ? readerState.paragraphPosition : 0,
      updatedAt: new Date().toISOString()
    })
    setReaderState((previous) => previous.position === nextState.position &&
      previous.paragraphPosition === nextState.paragraphPosition
      ? previous
      : {
        ...previous,
        position: nextState.position,
        paragraphPosition: nextState.paragraphPosition,
        updatedAt: nextState.updatedAt
      })
    try {
      writeLocalReaderState(book.id, accountScope, nextState)
      setSyncStatus(authUser?.id
        ? cloudSyncEnabled ? 'Saved on this device; syncing…' : 'Saved on this device only.'
        : 'Progress saved on this device.')
    } catch (storageError) {
      console.error('Could not save reading progress on this device:', storageError)
      setSyncStatus('Device storage is unavailable; progress may not be retained.')
    }
  }, [book.id, accountScope, authUser?.id, cloudSyncEnabled, currentSection, readerState, sections.length, stateReady])

  useEffect(() => {
    if (!stateReady || !cloudSyncEnabled) return undefined
    const timeout = window.setTimeout(async () => {
      try {
        await api(`/reading/${encodeURIComponent(book.id)}`, {
          method: 'PUT',
          body: { state: readerState }
        })
        setSyncStatus('Reading progress synced with your account.')
      } catch (syncError) {
        console.error('Could not sync reading progress:', syncError)
        setSyncStatus('Could not sync to your account. Your device copy is still saved.')
      }
    }, 700)
    return () => window.clearTimeout(timeout)
  }, [book.id, cloudSyncEnabled, readerState, stateReady])

  const updateReaderState = (updater) => {
    setReaderState((previous) => normalizeReaderState({
      ...updater(previous),
      updatedAt: new Date().toISOString()
    }))
  }
  const previous = () => setCurrentSection((page) => Math.max(0, page - 1))
  const next = () => setCurrentSection((page) => Math.min(sections.length - 1, page + 1))
  const current = sections[currentSection]
  const progressPercent = sections.length
    ? Math.round(((currentSection + (current?.paragraphs.length
      ? Math.min(readerState.paragraphPosition, current.paragraphs.length) / current.paragraphs.length
      : 0)) / sections.length) * 100)
    : 0
  const continueReading = () => {
    const paragraph = readerPageRef.current?.querySelector(`[data-paragraph-index="${readerState.paragraphPosition}"]`)
      || readerPageRef.current
    paragraph?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const saveSpeechPosition = (paragraphIndex) => {
    updateReaderState((state) => ({ ...state, paragraphPosition: paragraphIndex }))
  }
  const playSection = () => {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      setSpeechMessage('Text-to-speech is not supported by this browser. Try a recent version of Chrome, Edge, or Safari.')
      return
    }
    if (speechStatus === 'paused') {
      window.speechSynthesis.resume()
      setSpeechStatus('playing')
      setSpeechMessage(`Reading ${current.title}`)
      return
    }
    if (!current?.paragraphs.length) return

    const synthesis = window.speechSynthesis
    const session = speechSessionRef.current + 1
    speechSessionRef.current = session
    synthesis.cancel()
    const startParagraph = readerState.paragraphPosition >= current.paragraphs.length
      ? 0
      : readerState.paragraphPosition
    speechProgressRef.current = startParagraph
    const chunks = current.paragraphs
      .slice(startParagraph)
      .flatMap((paragraph, index) => splitSpeechParagraph(paragraph, startParagraph + index))
      .map((chunk, index, allChunks) => ({
        ...chunk,
        lastForParagraph: allChunks[index + 1]?.paragraphIndex !== chunk.paragraphIndex,
        lastInSection: index === allChunks.length - 1
      }))
    if (!chunks.length) return

    chunks.forEach((chunk) => {
      const utterance = new window.SpeechSynthesisUtterance(chunk.text)
      utterance.rate = speechRate
      const voice = speechVoices.find((availableVoice) => availableVoice.voiceURI === speechVoice)
      if (voice) utterance.voice = voice
      utterance.onstart = () => {
        if (speechSessionRef.current !== session) return
        speechProgressRef.current = chunk.paragraphIndex
        setSpeechParagraphIndex(chunk.paragraphIndex)
        setSpeechSentenceRange(null)
      }
      utterance.onboundary = (event) => {
        if (speechSessionRef.current !== session || event.charIndex == null) return
        const paragraph = current.paragraphs[chunk.paragraphIndex]
        const range = getSentenceRange(paragraph, chunk.startOffset + event.charIndex)
        setSpeechParagraphIndex(chunk.paragraphIndex)
        setSpeechSentenceRange(range)
      }
      utterance.onend = () => {
        if (speechSessionRef.current !== session) return
        if (chunk.lastForParagraph) {
          const nextParagraph = chunk.paragraphIndex + 1
          speechProgressRef.current = nextParagraph
          saveSpeechPosition(nextParagraph)
          if (chunk.lastInSection) {
            setSpeechParagraphIndex(null)
            setSpeechSentenceRange(null)
          }
        }
        if (chunk.lastInSection) {
          setSpeechStatus('idle')
          setSpeechMessage('Finished reading this section.')
        }
      }
      utterance.onerror = (event) => {
        if (speechSessionRef.current === session && event.error !== 'canceled' && event.error !== 'interrupted') {
          setSpeechStatus('idle')
          setSpeechMessage('Audio playback could not continue. Please try again.')
          setSpeechParagraphIndex(null)
          setSpeechSentenceRange(null)
        }
      }
      synthesis.speak(utterance)
    })
    setSpeechStatus('playing')
    setSpeechMessage(`Reading ${current.title}`)
  }
  const pauseSpeech = () => {
    window.speechSynthesis.pause()
    saveSpeechPosition(speechProgressRef.current)
    setSpeechStatus('paused')
    setSpeechMessage('Audio paused.')
  }
  const stopSpeech = () => {
    saveSpeechPosition(speechProgressRef.current)
    speechSessionRef.current += 1
    window.speechSynthesis.cancel()
    setSpeechStatus('idle')
    setSpeechMessage('Audio stopped.')
    setSpeechParagraphIndex(null)
    setSpeechSentenceRange(null)
  }
  const selectedText = () => {
    const browserSelection = window.getSelection()
    if (!browserSelection?.rangeCount) return null
    return getSelectedParagraph(browserSelection.getRangeAt(0), readerPageRef.current)
  }
  const addBookmark = () => {
    const createdAt = new Date().toISOString()
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
    updateReaderState((state) => ({
      ...state,
      bookmarks: [...state.bookmarks, { id, sectionIndex: currentSection, title: current?.title || `Section ${currentSection + 1}`, note: '', createdAt }]
    }))
  }
  const addHighlight = () => {
    const selected = selection
    if (!selected) return
    const createdAt = new Date().toISOString()
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
    updateReaderState((state) => ({
      ...state,
      highlights: [...state.highlights, { ...selected, id, sectionIndex: currentSection, color: 'yellow', note: '', createdAt }]
    }))
    window.getSelection()?.removeAllRanges()
    setSelection(null)
  }
  const captureSelection = () => setSelection(selectedText())
  const goToBookmark = (bookmark) => {
    setCurrentSection(Math.min(bookmark.sectionIndex, Math.max(0, sections.length - 1)))
    setSelection(null)
  }
  const removeAnnotation = (key, id) => updateReaderState((state) => ({
    ...state,
    [key]: state[key].filter((annotation) => annotation.id !== id)
  }))

  return (
    <main className="book-reader" id="main-content" tabIndex="-1">
      <header className="reader-topbar">
        <button className="reader-back-button" type="button" onClick={onBack}><FaArrowLeft /> {t('Reading room')}</button>
        <span><FaBookOpen /> {t('BookStore Reader')}</span>
        {book.price != null && <button className="reader-top-buy" type="button" onClick={() => onBuy(book)}><FaShoppingBag /> Buy print copy · {book.price}</button>}
      </header>

      <div className="reader-book-heading">
        <BookCover className="reader-book-cover" src={book.image} title={book.title} author={book.author} />
        <div>
          <span className="reader-eyebrow">{t('PUBLIC-DOMAIN READING EDITION')}</span>
          <h1>{book.title}</h1>
          <p>by {book.author}</p>
          <small>Edition: {reader.credit}{reader.gutenbergId ? ` · Project Gutenberg eBook #${reader.gutenbergId}` : ''}</small>
          {reader.editionNote && <p className="reader-edition-note">{reader.editionNote}</p>}
        </div>
        {book.price != null && <button className="reader-heading-buy" type="button" onClick={() => onBuy(book)}><FaShoppingBag /> Buy this book · {book.price}</button>}
      </div>

      <section className="reader-content-wrap" aria-label="Book text">
        <>
            <div className="reader-progress-panel">
              <div className="reader-progress-label">
                <span>{t('Reading progress')}</span>
                <span>{progressPercent}%</span>
              </div>
              <div
                className="reader-progress-track"
                role="progressbar"
                aria-label="Book reading progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent}
              >
                <span style={{ width: `${progressPercent}%` }} />
              </div>
              <button type="button" className="reader-continue-button" onClick={continueReading} disabled={loading || !current} aria-label={t('Continue from')}>
                {t('Continue from')} {current?.title || 'your saved position'} · paragraph {Math.min(readerState.paragraphPosition + 1, current?.paragraphs.length || 1)}
              </button>
            </div>

            <div className="reader-toolbar">
              <span>{sections.length ? `${currentSection + 1} / ${sections.length}` : 'Preparing your book'}</span>
              <div className="reader-text-controls" aria-label="Text size">
                <button type="button" onClick={() => setFontSize((size) => Math.max(MIN_FONT_SIZE, size - 1))} disabled={fontSize === MIN_FONT_SIZE} aria-label={t('Decrease text size')}><FaMinus /></button>
                <span>{t('Text size')}</span>
                <button type="button" onClick={() => setFontSize((size) => Math.min(MAX_FONT_SIZE, size + 1))} disabled={fontSize === MAX_FONT_SIZE} aria-label={t('Increase text size')}><FaPlus /></button>
              </div>
            </div>

            <div className="reader-audio-controls" aria-label="Read aloud controls">
              <div className="reader-audio-actions">
                {speechStatus === 'playing' ? (
                  <button type="button" onClick={pauseSpeech} disabled={loading || !current}><FaPause /> {t('Pause')}</button>
                ) : (
                  <button type="button" onClick={playSection} disabled={loading || !current}>
                    {speechStatus === 'paused' ? <FaPlay /> : <FaVolumeUp />}
                    {t(speechStatus === 'paused' ? 'Resume' : 'Read aloud')}
                  </button>
                )}
                <button type="button" onClick={stopSpeech} disabled={speechStatus === 'idle'}><FaStop /> {t('Stop')}</button>
              </div>
              <label>
                {t('Voice')}
                <select value={speechVoice} onChange={(event) => setSpeechVoice(event.target.value)} disabled={speechStatus !== 'idle' || !speechVoices.length}>
                  <option value="">{t(speechVoices.length ? 'Default voice' : 'System default')}</option>
                  {speechVoices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}
                </select>
              </label>
              <label>
                {t('Speed')}
                <select value={speechRate} onChange={(event) => setSpeechRate(Number(event.target.value))} disabled={speechStatus !== 'idle'}>
                  <option value={0.75}>0.75×</option>
                  <option value={1}>1×</option>
                  <option value={1.25}>1.25×</option>
                  <option value={1.5}>1.5×</option>
                  <option value={2}>2×</option>
                </select>
              </label>
              <span className="reader-audio-status" role="status" aria-live="polite">{t(speechMessage || 'Uses voices available on your device.')}</span>
            </div>

            <div className="reader-annotation-toolbar">
              <button type="button" onClick={addBookmark} disabled={loading || !current || readerState.bookmarks.length >= 100}>{t('Bookmark this section')}</button>
              <button type="button" onClick={addHighlight} disabled={!selection || readerState.highlights.length >= 100}>{t('Highlight selected text')}</button>
              <span className="reader-sync-status" role="status" aria-live="polite">{syncStatus}</span>
            </div>
            {selection && <p className="reader-selection-preview">Selected: “{selection.quote}”</p>}

            {loading && <p className="reader-status">{t('Loading the reading edition…')}</p>}
            {error && <div className="reader-error" role="alert">{error}</div>}
            {!loading && !error && current && (
              <article className="reader-page" style={{ fontSize: `${fontSize}px` }} ref={readerPageRef} onMouseUp={captureSelection} onKeyUp={captureSelection}>
                <h2>{current.title}</h2>
                {current.paragraphs.map((paragraph, index) => {
                  const marks = readerState.highlights.filter((highlight) => highlight.sectionIndex === currentSection && highlight.paragraphIndex === index)
                  const isSpeaking = speechParagraphIndex === index
                  const speechRange = isSpeaking ? speechSentenceRange : null
                  return (
                    <p className={isSpeaking ? 'reader-paragraph-speaking' : undefined} key={`${currentSection}-${index}`} data-paragraph-index={index}>
                      {renderParagraphText(paragraph, marks, speechRange)}
                    </p>
                  )
                })}
              </article>
            )}

            {(readerState.bookmarks.length > 0 || readerState.highlights.length > 0) && (
              <aside className="reader-annotations" aria-label="Your bookmarks and highlights">
                <h2>{t('Your reading notes')}</h2>
                {readerState.bookmarks.map((bookmark) => (
                  <div className="reader-annotation-item" key={bookmark.id}>
                    <button type="button" onClick={() => goToBookmark(bookmark)}>Bookmark · {bookmark.title}</button>
                    <button type="button" aria-label={`${t('Remove')} bookmark ${bookmark.title}`} onClick={() => removeAnnotation('bookmarks', bookmark.id)}>{t('Remove')}</button>
                  </div>
                ))}
                {readerState.highlights.map((highlight) => (
                  <div className="reader-annotation-item" key={highlight.id}>
                    <button type="button" onClick={() => goToBookmark(highlight)}>“{highlight.quote}” · {sections[highlight.sectionIndex]?.title || `Section ${highlight.sectionIndex + 1}`}</button>
                    <button type="button" aria-label={`${t('Remove')} highlight`} onClick={() => removeAnnotation('highlights', highlight.id)}>{t('Remove')}</button>
                  </div>
                ))}
              </aside>
            )}

            <nav className="reader-pagination" aria-label="Reading navigation">
              <button type="button" onClick={previous} disabled={loading || currentSection === 0}><FaArrowLeft /> {t('Previous')}</button>
              <span>{sections.length ? t(`${Math.round(((currentSection + 1) / sections.length) * 100)}% read`) : ''}</span>
              <button type="button" onClick={next} disabled={loading || !sections.length || currentSection === sections.length - 1}>{t('Next')} <FaArrowRight /></button>
            </nav>
        </>
      </section>

      <footer className="reader-source">
        This reading edition is provided by {sourceName}. The book and edition credits are shown above.
      </footer>
    </main>
  )
}

export default BookReader
