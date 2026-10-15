import React, { useEffect, useState } from 'react'
import { FaTimes } from 'react-icons/fa'
import { api } from '../api'
import { useAccessibility } from '../accessibility'

function TrackOrderModal({ onClose, orderId: orderIdProp, orders = [], onOrdersChanged, pageMode = false }) {
  const { t } = useAccessibility()
  const [orderId, setOrderId] = useState(orderIdProp ?? '')
  const [returnReason, setReturnReason] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const order = orders.find((savedOrder) => String(savedOrder.orderId).toLowerCase() === orderId.trim().toLowerCase()) ?? null
  const steps = [
    { key: 'placed', title: 'Order Placed', desc: 'We received your order.' },
    { key: 'packed', title: 'Packed', desc: 'Book is being packed securely.' },
    { key: 'shipped', title: 'Shipped', desc: 'Out for delivery partner has picked it.' },
    { key: 'delivered', title: 'Delivered', desc: 'Enjoy reading!' }
  ]

  useEffect(() => {
    if (orderIdProp) setOrderId(orderIdProp)
  }, [orderIdProp])

  useEffect(() => {
    setActionError('')
    setActionMessage('')
    setReturnReason('')
  }, [order?.orderId])

  const refreshTracking = async () => {
    if (!order) return
    setBusy(true)
    setActionError('')
    setActionMessage('')
    try {
      const tracking = await api(`/orders/${encodeURIComponent(order.orderId)}/tracking`)
      onOrdersChanged?.(order.orderId, tracking)
      if (tracking.notification?.sent === false) {
        setActionError(tracking.notification.error)
      } else {
        setActionMessage(t('Carrier tracking has been refreshed.'))
      }
    } catch (error) {
      setActionError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const requestReturn = async (event) => {
    event.preventDefault()
    if (!order) return
    setBusy(true)
    setActionError('')
    setActionMessage('')
    try {
      const returnRequest = await api(`/orders/${encodeURIComponent(order.orderId)}/returns`, {
        method: 'POST',
        body: { reason: returnReason }
      })
      onOrdersChanged?.(order.orderId, { returnRequest })
      setActionMessage(t('Your return request has been sent to the store.'))
      setReturnReason('')
    } catch (error) {
      setActionError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const completedIndex = order ? steps.findIndex((step) => step.key === order.status) : -1


  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div
      className={pageMode ? 'customer-orders-page' : 'modal-overlay'}
      onMouseDown={(e) => {
        if (!pageMode && e.currentTarget === e.target) onClose?.()
      }}
    >
      <div
        className={pageMode ? 'customer-orders-panel' : 'modal track-order-modal'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="track-order-title"
      >
        <button className="modal-close" onClick={onClose} aria-label={t('Close')}>
          <FaTimes />
        </button>

        <div className="modal-header">
          <h2 id="track-order-title">📦 {t('Orders and delivery tracking')}</h2>
          <p>{t('View your purchases, payment status, and delivery updates.')}</p>
        </div>

        <div className="modal-body">
          <section className="orders-history-section" aria-label={t('Your orders')}>
            <div className="orders-section-heading">
              <h3>{t('Your orders')}</h3>
              <span>{orders.length} {t(orders.length === 1 ? 'order' : 'orders')}</span>
            </div>
            {orders.length ? (
              <div className="order-history">
                {orders.map((savedOrder) => (
                  <button
                    key={savedOrder.orderId}
                    type="button"
                    className={savedOrder.orderId === order?.orderId ? 'selected' : ''}
                    aria-pressed={savedOrder.orderId === order?.orderId}
                    onClick={() => setOrderId(savedOrder.orderId)}
                  >
                    <strong>{savedOrder.orderId}</strong>
                    <span>
                      {new Date(savedOrder.createdAt).toLocaleDateString()} · {savedOrder.status} · ₹{savedOrder.total ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="order-not-found">{t('You have no orders yet. Once you place an order, its payment and delivery updates will appear here.')}</p>
            )}
          </section>

          <label className="order-id-search">
            {t('Find an order by ID')}
            <input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder={t('Enter an order ID (e.g. BK-123456)')}
              aria-label={t('Order ID')}
            />
          </label>

          {order ? (
            <>
              <div className="order-summary">
                <strong>{order.orderId}</strong>
                <span>
                  {order.items?.reduce((count, item) => count + item.qty, 0) ?? 0} {t('book item(s)')}
                  {order.discount > 0 ? ` • ${t('Saved')} ₹${order.discount}` : ''}
                  {' '}• ₹{order.total ?? 0}
                </span>
              </div>
              <section className="order-items">
                <h3>{t('Items in this order')}</h3>
                {order.items?.map((item) => (
                  <div className="order-item" key={item.id}>
                    <img src={item.image} alt="" />
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.author} · {t('Qty')} {item.qty}</span>
                    </div>
                    <strong>₹{item.unitPrice * item.qty}</strong>
                  </div>
                ))}
                <div className="order-totals">
                  <span>{t('Subtotal')}</span><span>₹{order.subtotal}</span>
                  {order.discount > 0 && <><span>{t('Discount')}</span><span>−₹{order.discount}</span></>}
                  <strong>{order.paymentStatus === 'paid' ? t('Total paid') : t('Total due')}</strong><strong>₹{order.total}</strong>
                </div>
              </section>
              {order.shippingAddress?.line1 && (
                <section className="order-delivery-address">
                  <h3>{t('Delivery address')}</h3>
                  <p>
                    <strong>{order.shippingAddress.name}</strong><br />
                    {order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}<br />
                    {[order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.postalCode].filter(Boolean).join(', ')}
                  </p>
                  {order.shippingAddress.phone && <p>{t('Phone')}: {order.shippingAddress.phone}</p>}
                </section>
              )}
              {order.paymentStatus !== 'paid' && (
                <p className={`order-payment-notice ${order.paymentStatus || 'pending'}`}>
                  {order.paymentStatus === 'failed'
                    ? t('Payment failed. Your cart is still available; you can try checkout again.')
                    : order.paymentStatus === 'legacy'
                      ? t('This is a historical test order. No payment was processed for it.')
                    : order.paymentStatus === 'refund_required'
                      ? t('Payment was received, but this order needs support review. Please contact the store.')
                      : order.paymentStatus === 'cod_pending'
                        ? t('Cash on delivery: pay the delivery partner when the order arrives. The store will confirm after collecting cash.')
                      : order.paymentMethod === 'phonepe_qr'
                        ? t('Your UPI payment reference was submitted. The store will confirm your order after checking the payment.')
                      : t('Payment is being confirmed. This order is not confirmed until payment succeeds.')}
                </p>
              )}
              {order.paymentStatus === 'paid' && order.status === 'cancelled' && (
                <p className="order-payment-notice">{t('This order was cancelled. Contact the store if you need help with a refund.')}</p>
              )}
              {['paid', 'cod_pending'].includes(order.paymentStatus) && order.status !== 'cancelled' && <div className="timeline">
                {steps.map((step, idx) => {
                  const completed = idx <= completedIndex
                  return (
                    <div key={step.key} className={`track-step ${completed ? 'completed' : ''}`}>
                      <div className="dot" />
                      <div className="step-content">
                        <h4>{t(step.title)}</h4>
                        <p>{t(step.desc)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>}
              {['paid', 'cod_pending'].includes(order.paymentStatus) && order.trackingNumber && (
                <section className="carrier-tracking">
                  <h3>{t('Carrier tracking')}</h3>
                  <p><strong>{order.courierName || 'Courier'}</strong> · AWB {order.trackingNumber}</p>
                  {order.trackingStatus && <p>{t('Latest update:')} {order.trackingStatus}</p>}
                  <div className="tracking-actions">
                    <button type="button" className="btn-secondary-large" onClick={refreshTracking} disabled={busy}>{t('Refresh tracking')}</button>
                    {order.trackingUrl && <a href={order.trackingUrl} target="_blank" rel="noreferrer">{t('Open carrier tracking')}</a>}
                  </div>
                </section>
              )}
              {['paid', 'cod_pending'].includes(order.paymentStatus) && !order.trackingNumber && order.status !== 'delivered' && order.status !== 'cancelled' && (
                <p className="order-tracking-pending">{t('Carrier tracking will appear here once the order is shipped and a tracking number is assigned.')}</p>
              )}
              {order.paymentStatus === 'paid' && order.status === 'delivered' && !order.returnRequest && (
                <form className="return-request-form" onSubmit={requestReturn}>
                  <h3>{t('Request a return')}</h3>
                  <p>{t('Returns can be requested within 7 days of delivery. The store will review your request.')}</p>
                  <label>{t('Reason')}<textarea value={returnReason} onChange={(event) => setReturnReason(event.target.value)} minLength={10} maxLength={1000} rows={3} required /></label>
                  <button type="submit" className="btn-secondary-large" disabled={busy}>{t(busy ? 'Sending…' : 'Submit return request')}</button>
                </form>
              )}
              {order.returnRequest && (
                <p className="return-request-status">Return request: <strong>{order.returnRequest.status}</strong>
                  {order.returnRequest.refundStatus ? ` · Refund ${order.returnRequest.refundStatus}` : ''}
                </p>
              )}
              {actionError && <p className="auth-error" role="alert">{actionError}</p>}
              {actionMessage && <p className="review-success" role="status">{actionMessage}</p>}
            </>
          ) : orderId.trim() ? (
            <p className="order-not-found">{t('No order found for')} “{orderId.trim()}”. {t('Choose an order above or check the ID.')}</p>
          ) : null}

          <button type="button" className="btn-secondary-large" onClick={onClose}>
            {t('Done')}
          </button>
        </div>

        {order && <p className="modal-footer">{t('Order ID')}: {order.orderId}</p>}

      </div>
    </div>
  )
}

export default TrackOrderModal
