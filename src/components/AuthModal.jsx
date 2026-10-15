import React, { useEffect, useState } from 'react'
import { FaBookOpen, FaTimes } from 'react-icons/fa'
import { prepareProfilePhoto } from '../profilePhoto'
import { useAccessibility } from '../accessibility'

function AuthModal({ onSubmit, onVerifyOtp, onResendOtp, onCancelOtp, challenge, error, busy, onClose }) {
  const { t } = useAccessibility()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [avatar, setAvatar] = useState(null)
  const [photoError, setPhotoError] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [code, setCode] = useState('')
  const [resendCountdown, setResendCountdown] = useState(0)
  const isRegister = mode === 'register'

  useEffect(() => {
    setCode('')
    setResendCountdown(challenge?.resendAfterSeconds || 0)
    if (!challenge) return undefined
    setPassword('')
    const timer = window.setInterval(() => {
      setResendCountdown((remaining) => Math.max(0, remaining - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [challenge?.challengeId, challenge?.resendAfterSeconds])

  const selectPhoto = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPhotoBusy(true)
    setPhotoError('')
    try {
      setAvatar(await prepareProfilePhoto(file))
    } catch (error) {
      setPhotoError(error.message || 'Photo could not be opened. Try another image.')
    } finally {
      setPhotoBusy(false)
    }
  }

  return (
    <div className="modal-overlay auth-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose?.()
    }}>
      <section className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-close" type="button" onClick={onClose} aria-label={t('Close sign in')} disabled={busy}>
          <FaTimes />
        </button>
        <div className="auth-brand"><FaBookOpen /> BookStore</div>
        <div className="modal-header">
          <h2 id="auth-title">{t(challenge ? 'Verify your email' : isRegister ? 'Create your account' : 'Welcome back')}</h2>
          <p>{t(challenge
            ? `Enter the 6-digit code sent to ${challenge.email}. The code expires in 5 minutes.`
            : isRegister
              ? 'Sign up to save your cart, wishlist and orders.'
              : 'Log in to save your cart, wishlist and orders.')}</p>
        </div>

        {challenge ? (
          <form
            className="modal-body"
            autoComplete="off"
            onSubmit={(event) => {
              event.preventDefault()
              onVerifyOtp?.({ challengeId: challenge.challengeId, code, avatar })
            }}
          >
            <label className="auth-otp-label" htmlFor="auth-otp-code">{t('Email verification code')}</label>
            <input
              id="auth-otp-code"
              className="auth-otp-input"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              aria-label={t('Email verification code')}
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              autoFocus
            />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="btn-primary-large" type="submit" disabled={busy || code.length !== 6}>
              {t(busy ? 'Verifying…' : 'Verify and log in')}
            </button>
            <button
              className="auth-resend"
              type="button"
              disabled={busy || resendCountdown > 0}
              onClick={() => onResendOtp?.(challenge.challengeId)}
            >
              {t(resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend verification code')}
            </button>
            <button className="auth-use-another" type="button" onClick={() => {
              setEmail('')
              setPassword('')
              onCancelOtp?.()
            }} disabled={busy}>
              {t('Use another account')}
            </button>
          </form>
        ) : (
          <form
            className="modal-body"
            autoComplete="off"
            onSubmit={(event) => {
              event.preventDefault()
              onSubmit?.({
                mode,
                email: email.trim(),
                password,
                name: name.trim(),
                phone: phone.trim(),
                city: city.trim(),
                avatar
              })
            }}
          >
            <div className="profile-photo-editor auth-photo-editor">
              {avatar
                ? <img className="profile-photo-preview" src={avatar} alt={t('Profile photo preview')} />
                : <div className="profile-photo-placeholder" aria-hidden="true">{name.trim().charAt(0).toUpperCase() || '👤'}</div>}
              <div className="profile-photo-actions">
                <label className="profile-photo-upload">
                  {t(photoBusy ? 'Preparing photo…' : avatar ? 'Change photo' : 'Add a profile photo (optional)')}
                  <input type="file" accept="image/*" onChange={selectPhoto} disabled={photoBusy || busy} />
                </label>
                {avatar && <button type="button" className="profile-photo-remove" onClick={() => { setAvatar(null); setPhotoError('') }}>{t('Remove photo')}</button>}
                <small>{t('Your photo will appear beside your name after sign in.')}</small>
              </div>
            </div>
            {photoError && <p className="auth-error" role="alert">{photoError}</p>}
            {isRegister && (
              <>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t('Full name')} aria-label={t('Full name')} autoComplete="off" minLength={2} maxLength={80} required />
                <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={t('Phone (optional)')} aria-label={t('Phone')} type="tel" autoComplete="off" pattern="[0-9]{7,15}" />
                <input value={city} onChange={(event) => setCity(event.target.value)} placeholder={t('City (optional)')} aria-label={t('City')} autoComplete="off" maxLength={80} />
              </>
            )}
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t('Email address')} aria-label={t('Email address')} type="email" autoComplete="off" required />
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('Password (at least 8 characters)')}
              aria-label={t('Password')}
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="btn-primary-large" type="submit" disabled={busy || photoBusy}>
              {t(busy ? 'Please wait…' : photoBusy ? 'Preparing photo…' : isRegister ? 'Create account' : 'Log in')}
            </button>
          </form>
        )}

        {!challenge && (
          <p className="auth-switch">
            {t(isRegister ? 'Already have an account?' : 'New to BookStore?')}{' '}
            <button type="button" onClick={() => { setMode(isRegister ? 'login' : 'register'); }} disabled={busy}>
              {t(isRegister ? 'Log in' : 'Create an account')}
            </button>
          </p>
        )}
        <p className="modal-footer">{t('Your password is encrypted and never stored as plain text.')}</p>
      </section>
    </div>
  )
}

export default AuthModal
