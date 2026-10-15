import React, { useState } from 'react'
import { FaTimes, FaCreditCard, FaMobileAlt, FaMoneyBillWave } from 'react-icons/fa'
import { useAccessibility } from '../accessibility'

let checkoutScriptPromise

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve()
  if (!checkoutScriptPromise) {
    checkoutScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      script.onload = resolve
      script.onerror = () => {
        checkoutScriptPromise = null
        reject(new Error('Could not load the secure payment window. Check your connection and try again.'))
      }
      document.body.appendChild(script)
    })
  }
  return checkoutScriptPromise
}

function CheckoutModal({ profile, total, discount, cardEnabled, paymentMode, onCreateOrder, onPaymentSuccess, onManualPayment, onClose }) {
  const { t } = useAccessibility()
  const [address, setAddress] = useState({
    name: profile?.name || '',
    phone: profile?.phone || '',
    line1: '',
    line2: '',
    city: profile?.city || '',
    state: '',
    postalCode: ''
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('delivery')
  const [selectedMethod, setSelectedMethod] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [checkoutForm, setCheckoutForm] = useState(null)

  const update = (event) => setAddress((current) => ({ ...current, [event.target.name]: event.target.value }))

  const continueToPayment = () => {
    if (!checkoutForm?.reportValidity()) return
    setStep('payment')
    setError('')
  }

  const pay = async (event) => {
    event.preventDefault()
    if (step === 'delivery') {
      continueToPayment()
      return
    }
    if (!selectedMethod) {
      setError(t('Choose a payment method to continue.'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const payment = await onCreateOrder(address, {
        paymentMethod: selectedMethod,
        paymentReference
      })
      if (payment.mode === 'phonepe_qr' || payment.mode === 'cod') {
        await onManualPayment(payment)
        onClose()
        return
      }
      await loadRazorpay()
      const checkout = new window.Razorpay({
        key: payment.keyId,
        amount: payment.order.amount,
        currency: payment.order.currency,
        name: 'BookStore',
        description: `Book order ${payment.order.receipt}`,
        order_id: payment.order.id,
        prefill: payment.customer,
        notes: { bookstore_order_id: payment.order.receipt },
        method: { card: true, upi: true },
        theme: { color: '#2874f0' },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (result) => {
          try {
            await onPaymentSuccess(result)
            onClose()
          } catch (paymentError) {
            setError(paymentError.message)
            setBusy(false)
          }
        }
      })
      checkout.on('payment.failed', (result) => {
        setError(result.error?.description || 'Payment was not completed. You can try again.')
        setBusy(false)
      })
      checkout.open()
    } catch (paymentError) {
      setError(paymentError.message)
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay checkout-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose()
    }}>
      <section className="modal checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
        <div className="checkout-heading">
          <div>
            <p className="checkout-eyebrow">{t('SECURE CHECKOUT')}</p>
            <h2 id="checkout-title">{t('Delivery & payment')}</h2>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label={t('Close checkout')} disabled={busy}>
            <FaTimes />
          </button>
        </div>

        <div className="checkout-summary">
          <span>{t('Payable amount')}</span>
          <strong>₹{total}</strong>
          {discount > 0 && <small>{t('Welcome discount included:')} −₹{discount}</small>}
        </div>

        <form className="checkout-form" ref={setCheckoutForm} onSubmit={pay}>
          {step === 'delivery' ? (
            <>
              <h3>{t('Delivery address')}</h3>
              <div className="checkout-fields">
                <label>{t('Recipient name')}<input name="name" autoComplete="name" required minLength={2} maxLength={80} value={address.name} onChange={update} /></label>
                <label>{t('Mobile number')}<input name="phone" type="tel" autoComplete="tel" inputMode="numeric" pattern="[0-9]{10}" required value={address.phone} onChange={update} /></label>
                <label className="checkout-field-wide">{t('House / street address')}<input name="line1" autoComplete="address-line1" required minLength={5} maxLength={160} value={address.line1} onChange={update} /></label>
                <label className="checkout-field-wide">{t('Area, landmark (optional)')}<input name="line2" autoComplete="address-line2" maxLength={160} value={address.line2} onChange={update} /></label>
                <label>{t('City')}<input name="city" autoComplete="address-level2" required minLength={2} maxLength={80} value={address.city} onChange={update} /></label>
                <label>{t('State')}<input name="state" autoComplete="address-level1" required minLength={2} maxLength={80} value={address.state} onChange={update} /></label>
                <label>{t('PIN code')}<input name="postalCode" autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{6}" required value={address.postalCode} onChange={update} /></label>
              </div>
              <button className="btn-primary-large checkout-pay-button" type="button" onClick={continueToPayment}>
                {t('Next: choose payment')}
              </button>
            </>
          ) : (
            <>
              <h3>{t('Choose payment method')}</h3>
              <button type="button" className={`payment-choice ${selectedMethod === 'phonepe_qr' ? 'selected' : ''}`} onClick={() => setSelectedMethod('phonepe_qr')}>
                <FaMobileAlt /><span><strong>{t('PhonePe / UPI QR')}</strong><small>{t('Scan and pay now')}</small></span>
              </button>
              <button type="button" className={`payment-choice ${selectedMethod === 'cod' ? 'selected' : ''}`} onClick={() => setSelectedMethod('cod')}>
                <FaMoneyBillWave /><span><strong>{t('Cash on delivery')}</strong><small>{t('Pay cash when your order is delivered')}</small></span>
              </button>
              <button type="button" className={`payment-choice ${selectedMethod === 'razorpay' ? 'selected' : ''}`} disabled={!cardEnabled} onClick={() => setSelectedMethod('razorpay')}>
                <FaCreditCard /><span><strong>{t('Credit / debit card')}</strong><small>{cardEnabled ? t('Secure card payment') : t('Available after Razorpay is configured')}</small></span>
              </button>

              {selectedMethod === 'phonepe_qr' && (
                <div className="manual-payment-panel">
                  <div className="payment-method-note">
                    <FaMobileAlt />
                    <span>{t('Scan this PhonePe QR and pay the exact amount shown. Enter the reference from your payment app; the store will verify payment manually.')}</span>
                  </div>
                  <img className="manual-payment-qr" src="/payments/phonepe-qr.png" alt={t('PhonePe payment QR code')} />
                  <p className="manual-payment-total">{t('Pay exactly')} ₹{total}</p>
                  <label className="manual-payment-reference">
                    {t('UPI transaction reference / UTR')}
                    <input
                      autoComplete="off"
                      required
                      minLength={6}
                      maxLength={40}
                      pattern="[A-Za-z0-9-]{6,40}"
                      value={paymentReference}
                      onChange={(event) => setPaymentReference(event.target.value.trim())}
                      placeholder={t('Enter the UTR from your payment app')}
                    />
                  </label>
                </div>
              )}
              {selectedMethod === 'cod' && (
                <p className="payment-method-note"><FaMoneyBillWave />{t('No payment is due now. Pay the delivery partner when the order arrives.')}</p>
              )}
              {selectedMethod === 'razorpay' && (
                <p className="payment-method-note"><FaCreditCard />{t('Card details are entered only in the secure Razorpay checkout.')}</p>
              )}
          <p className="checkout-disclaimer">{t('Your delivery details are saved with this order and visible to authorized store admins only, to fulfill and support the delivery.')}</p>
              {paymentMode === 'test' && selectedMethod === 'razorpay' && (
            <p className="checkout-config-notice" role="status">
              {t('Razorpay test mode is active. Use Razorpay test payment details; no real charge will be made.')}
            </p>
          )}
          {error && <p className="auth-error" role="alert">{error}</p>}
              <div className="checkout-step-actions">
                <button className="admin-action-btn" type="button" onClick={() => { setStep('delivery'); setError('') }} disabled={busy}>{t('Back')}</button>
                <button className="btn-primary-large checkout-pay-button" type="submit" disabled={busy || !selectedMethod}>
                  {busy
                    ? selectedMethod === 'razorpay' ? t('Opening secure payment…') : t('Submitting order…')
                    : selectedMethod === 'phonepe_qr' ? `${t('Submit payment reference')} ₹${total}`
                      : selectedMethod === 'cod' ? t('Place cash on delivery order')
                        : `${t('Continue to secure card payment')} ₹${total}`}
                </button>
              </div>
              <p className="checkout-disclaimer">
                {selectedMethod === 'phonepe_qr'
                  ? t('Your order is confirmed only after an admin verifies your payment in PhonePe.')
                  : selectedMethod === 'cod'
                    ? t('Your order remains unpaid until cash is collected on delivery and confirmed by the store.')
                    : t('Payment is processed by Razorpay. Your order is confirmed only after payment is verified.')}
              </p>
            </>
          )}
        </form>
      </section>
    </div>
  )
}

export default CheckoutModal
