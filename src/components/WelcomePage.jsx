import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccessibility } from '../accessibility'
import './WelcomePage.css'

const WelcomeScene = lazy(() => import('./WelcomeScene'))

function SceneFallback({ onReady }) {
  useEffect(() => onReady(), [onReady])

  return (
    <div className="welcome-scene-fallback" aria-hidden="true">
      <div className="fallback-person">
        <span className="fallback-head" />
        <span className="fallback-body" />
        <span className="fallback-arm" />
        <span className="fallback-legs" />
        <span className="fallback-book" />
      </div>
    </div>
  )
}

function WelcomePage() {
  const navigate = useNavigate()
  const { language, setLanguage } = useAccessibility()
  const pageRef = useRef()
  const [sceneReady, setSceneReady] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(10)
  const [showThanks, setShowThanks] = useState(false)
  const [buttonHit, setButtonHit] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [bookRevealed, setBookRevealed] = useState(false)
  const [soundOn, setSoundOn] = useState(false)
  const [soundError, setSoundError] = useState('')
  const transitionStarted = useRef(false)
  const autoEnterTimer = useRef()
  const buttonTapTimer = useRef()
  const transitionTimer = useRef()
  const audioContext = useRef(null)
  const soundEnabled = useRef(false)
  const setReady = useCallback(() => setSceneReady(true), [])
  const showThankYou = useCallback(() => setShowThanks(true), [])
  const fallback = <SceneFallback onReady={setReady} />
  const copy = language === 'hi'
    ? {
        kicker: 'एक नया अनुभव शुरू होता है',
        title: 'मेरी वेबसाइट में आपका स्वागत है',
        titleRows: [['आपका', 'स्वागत'], ['मेरी', 'वेबसाइट']],
        subtitle: 'कल्पना से बने विचार। आपके लिए बनाए गए अनुभव।',
        credit: 'निर्माता',
        enter: 'बुकस्टोर में प्रवेश करें',
        countdown: (seconds) => `${seconds} सेकंड में वेबसाइट खुल रही है…`,
        skip: 'इंट्रो छोड़ें',
        soundOn: 'आवाज़ चालू',
        soundOff: 'आवाज़ बंद',
        soundOnLabel: 'ध्वनि प्रभाव बंद करें',
        soundOffLabel: 'ध्वनि प्रभाव चालू करें',
        thanks: 'धन्यवाद!',
        loading: 'स्वागत की तैयारी हो रही है…',
        options: 'स्वागत विकल्प',
        hosts: ['गोलू · होस्ट', 'बुकस्टोर होस्ट'],
        brand: 'गोलू कुमार डिजिटल स्टूडियो',
        greeting: 'स्वागत है, अतिथि',
        intro: 'आपका बुकस्टोर में स्वागत है',
        explore: 'पुस्तकें देखें',
        collections: 'संग्रह देखें',
        shopping: 'शॉपिंग शुरू करें',
        ready: 'बुक रिवील तैयार है',
      }
    : {
        kicker: 'A new experience begins',
        title: 'Welcome to my website',
        titleRows: [['WELCOME', 'TO'], ['MY', 'WEBSITE']],
        subtitle: 'Ideas built with imagination. Experiences made for you.',
        credit: 'DEVELOPED BY',
        enter: 'ENTER BOOKSTORE',
        countdown: (seconds) => `Entering the website in ${seconds} seconds…`,
        skip: 'SKIP INTRO',
        soundOn: 'SOUND ON',
        soundOff: 'SOUND OFF',
        soundOnLabel: 'Mute sound effects',
        soundOffLabel: 'Enable sound effects',
        thanks: 'Thank you!',
        loading: 'Preparing your welcome…',
        options: 'Welcome options',
        hosts: ['Golu · Host', 'Bookstore Host'],
        brand: 'GOLU KUMAR DIGITAL STUDIO',
        greeting: 'Welcome back, Guest',
        intro: 'Welcome to our bookstore',
        explore: 'Explore books',
        collections: 'View collections',
        shopping: 'Start shopping',
        ready: 'Book reveal ready',
      }

  const playSound = useCallback((kind) => {
    const context = audioContext.current
    if (!soundEnabled.current || !context || context.state !== 'running') return

    const now = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const sound = {
      footstep: { start: 115, end: 68, duration: 0.11, volume: 0.035, type: 'sine' },
      book: { start: 520, end: 260, duration: 0.24, volume: 0.045, type: 'triangle' },
      tap: { start: 740, end: 280, duration: 0.1, volume: 0.055, type: 'triangle' },
    }[kind]

    oscillator.type = sound.type
    oscillator.frequency.setValueAtTime(sound.start, now)
    oscillator.frequency.exponentialRampToValueAtTime(sound.end, now + sound.duration)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(sound.volume, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + sound.duration)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + sound.duration)
  }, [])

  const handleFootstep = useCallback(() => playSound('footstep'), [playSound])
  const handleBookReveal = useCallback(() => {
    setBookRevealed(true)
    playSound('book')
  }, [playSound])

  const toggleSound = async () => {
    if (soundEnabled.current) {
      soundEnabled.current = false
      setSoundOn(false)
      return
    }

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext
    if (!AudioContextConstructor) {
      setSoundError('Sound effects are not supported in this browser.')
      return
    }

    try {
      if (!audioContext.current || audioContext.current.state === 'closed') {
        audioContext.current = new AudioContextConstructor()
      }
      await audioContext.current.resume()
      soundEnabled.current = true
      setSoundOn(true)
      setSoundError('')
    } catch (error) {
      soundEnabled.current = false
      setSoundOn(false)
      setSoundError(error instanceof Error ? error.message : 'Could not enable sound effects.')
    }
  }

  const enterWebsite = useCallback(() => {
    window.clearTimeout(autoEnterTimer.current)
    window.clearTimeout(buttonTapTimer.current)
    window.clearTimeout(transitionTimer.current)
    navigate('/', { replace: true, state: { welcomeCompleted: true } })
  }, [navigate])

  const beginTransition = useCallback(() => {
    if (transitionStarted.current) return
    transitionStarted.current = true
    setTransitioning(true)
    window.clearTimeout(autoEnterTimer.current)
    transitionTimer.current = window.setTimeout(enterWebsite, 720)
  }, [enterWebsite])

  const handleCharacterTap = useCallback(() => {
    setButtonHit(true)
    playSound('tap')
  }, [playSound])

  const handleEnterClick = () => {
    if (transitionStarted.current) return
    setButtonHit(true)
    playSound('tap')
    window.clearTimeout(buttonTapTimer.current)
    buttonTapTimer.current = window.setTimeout(beginTransition, 220)
  }

  const handlePointerMove = (event) => {
    if (!pageRef.current) return
    const bounds = pageRef.current.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width - 0.5
    const y = (event.clientY - bounds.top) / bounds.height - 0.5
    pageRef.current.style.setProperty('--text-tilt-x', `${x * 3}deg`)
    pageRef.current.style.setProperty('--text-tilt-y', `${y * -2}deg`)
    pageRef.current.style.setProperty('--text-shift-x', `${x * -6}px`)
    pageRef.current.style.setProperty('--text-shift-y', `${y * 4}px`)
  }

  useEffect(() => {
    if (showThanks) {
      const thankYouDelay = window.setTimeout(() => beginTransition(), 1800)
      return () => window.clearTimeout(thankYouDelay)
    }

    autoEnterTimer.current = window.setTimeout(beginTransition, 10000)
    const countdown = window.setInterval(() => {
      setSecondsLeft((seconds) => Math.max(0, seconds - 1))
    }, 1000)
    return () => {
      window.clearTimeout(autoEnterTimer.current)
      window.clearInterval(countdown)
      window.clearTimeout(buttonTapTimer.current)
      window.clearTimeout(transitionTimer.current)
    }
  }, [beginTransition, showThanks])

  useEffect(() => () => {
    soundEnabled.current = false
    if (audioContext.current && audioContext.current.state !== 'closed') {
      void audioContext.current.close()
    }
  }, [])

  return (
    <main
      ref={pageRef}
      className={`welcome-page${transitioning ? ' is-transitioning' : ''}${showThanks ? ' has-thanks' : ''}`}
      onPointerMove={handlePointerMove}
    >
      <div className="welcome-glow welcome-glow-blue" />
      <div className="welcome-glow welcome-glow-violet" />
      <div className="welcome-grid" aria-hidden="true" />
      <div className="welcome-scene">
        <Suspense fallback={fallback}>
          <WelcomeScene
            fallback={fallback}
            onReady={setReady}
            onThanks={showThankYou}
            onFootstep={handleFootstep}
            onBookReveal={handleBookReveal}
            onButtonHit={handleCharacterTap}
          />
        </Suspense>
      </div>
      <div className="welcome-host-label welcome-host-label-man">{copy.hosts[0]}</div>
      <div className="welcome-host-label welcome-host-label-woman">{copy.hosts[1]}</div>

      <div className="welcome-brand" aria-label={copy.brand}>
        <span className="welcome-brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M12 6.4C9.9 4.9 7 4.5 3.9 5.4v12.1c3.1-.9 6-.5 8.1 1 2.1-1.5 5-1.9 8.1-1V5.4c-3.1-.9-6-.5-8.1 1Z" />
            <path d="M12 6.5v12M6.3 8.6c1.5-.2 2.8 0 3.9.6M17.7 8.6c-1.5-.2-2.8 0-3.9.6" />
            <path d="m17.8 2.8.55 1.3 1.3.55-1.3.55-.55 1.3-.55-1.3-1.3-.55 1.3-.55.55-1.3Z" />
          </svg>
        </span>
        <span className="welcome-brand-text">{copy.brand}</span>
      </div>

      {bookRevealed && (
        <div className="welcome-book-status" role="status">
          {copy.ready}
        </div>
      )}

      {showThanks && (
        <p className="welcome-thanks-speech" role="status">
          {copy.thanks}
        </p>
      )}

      {!sceneReady && (
        <div className="welcome-loading" role="status">
          <span className="welcome-spinner" />
          <span>{copy.loading}</span>
        </div>
      )}

      <section className="welcome-content" aria-labelledby="welcome-title">
        <p className="welcome-kicker"><span /> {copy.kicker}</p>
        <div className="welcome-greeting-tag">{copy.greeting}</div>
        <h1 id="welcome-title" aria-label={copy.title}>
          <span className="welcome-title-line" aria-hidden="true">
            {copy.titleRows[0].map((word, index) => (
              <span className="welcome-title-word" key={word} style={{ animationDelay: `${0.92 + index * 0.24}s` }}>{word}</span>
            ))}
          </span>
          <strong aria-hidden="true">
            {copy.titleRows[1].map((word, index) => (
              <span className="welcome-title-word" key={word} style={{ animationDelay: `${1.4 + index * 0.24}s` }}>{word}</span>
            ))}
          </strong>
        </h1>
        <p className="welcome-intro">{copy.intro}</p>
        <p className="welcome-subtitle">{copy.subtitle}</p>
        <p className="welcome-credit">{copy.credit} <strong>GOLU KUMAR</strong></p>
        <div className="welcome-cta-row">
          <button className="welcome-quick-action" type="button" onClick={handleEnterClick}>{copy.explore}</button>
          <button className="welcome-quick-action" type="button" onClick={handleEnterClick}>{copy.collections}</button>
          <button className="welcome-quick-action" type="button" onClick={handleEnterClick}>{copy.shopping}</button>
        </div>
        <button
          className={`welcome-enter-button${buttonHit ? ' is-hit' : ''}`}
          type="button"
          onClick={handleEnterClick}
        >
          <span>{copy.enter}</span>
          <span className="welcome-enter-arrow" aria-hidden="true">↗</span>
        </button>
        <p className="welcome-auto-note">{copy.countdown(secondsLeft)}</p>
      </section>

      <div className="welcome-corner-label" aria-hidden="true"><span className="welcome-corner-mark" /> <span>·</span> DIGITAL STUDIO</div>
      <div className="welcome-transition" aria-hidden="true" />
    </main>
  )
}

export default WelcomePage
