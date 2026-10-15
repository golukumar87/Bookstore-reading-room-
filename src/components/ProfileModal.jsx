import React, { useEffect, useState } from 'react'
import { FaTimes } from 'react-icons/fa'
import { prepareProfilePhoto } from '../profilePhoto'
import { useAccessibility } from '../accessibility'

function ProfileModal({ profile, onSave, onClose }) {
  const { t } = useAccessibility()
  const [name, setName] = useState(profile?.name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [city, setCity] = useState(profile?.city ?? '')
  const [avatar, setAvatar] = useState(profile?.avatar ?? null)
  const [photoError, setPhotoError] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

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
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) onClose?.()
      }}
    >
      <div className="modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label={t('Close')}>
          <FaTimes />
        </button>

        <div className="modal-header">
          <h2>👤 {t('Profile Settings')}</h2>
          <p>{t('Update your account details and profile photo.')}</p>
        </div>

        <form
          className="modal-body"
          onSubmit={(e) => {
            e.preventDefault()
            onSave?.({ name: name.trim(), phone: phone.trim(), city: city.trim(), avatar })
          }}
        >
          <div className="profile-photo-editor">
            {avatar
              ? <img className="profile-photo-preview" src={avatar} alt={t('Profile preview')} />
              : <div className="profile-photo-placeholder" aria-hidden="true">{name.trim().charAt(0).toUpperCase() || '👤'}</div>}
            <div className="profile-photo-actions">
              <label className="profile-photo-upload">
                {t(photoBusy ? 'Preparing photo…' : avatar ? 'Change photo' : 'Add a photo')}
                <input type="file" accept="image/*" onChange={selectPhoto} disabled={photoBusy} />
              </label>
              {avatar && <button type="button" className="profile-photo-remove" onClick={() => { setAvatar(null); setPhotoError('') }}>{t('Remove photo')}</button>}
              <small>{t('Images are resized before saving. Maximum 10 MB upload.')}</small>
            </div>
          </div>
          {photoError && <p className="auth-error" role="alert">{photoError}</p>}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Name')} aria-label={t('Name')} required />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('Phone')}
            aria-label={t('Phone')}
            type="tel"
            pattern="[0-9]{7,15}"
            required
          />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t('City')} aria-label={t('City')} required />

          <div className="btn-row">
            <button className="btn-primary-large" type="submit" disabled={photoBusy}>
              {t('Save')}
            </button>
            <button className="btn-secondary-large" type="button" onClick={onClose}>
              {t('Cancel')}
            </button>
          </div>
        </form>

        <p className="modal-footer">{t('Your profile and photo are saved to your account.')}</p>
      </div>
    </div>
  )
}

export default ProfileModal
