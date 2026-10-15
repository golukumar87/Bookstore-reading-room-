import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api'

function AdminDashboard() {
  const [admin, setAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [overview, setOverview] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [updatingOrder, setUpdatingOrder] = useState('')
  const [orderNotifications, setOrderNotifications] = useState({})
  const [updatingBook, setUpdatingBook] = useState('')
  const [lookingUpBook, setLookingUpBook] = useState('')
  const [updatingReturn, setUpdatingReturn] = useState('')
  const [salesPeriod, setSalesPeriod] = useState(7)
  const [salesReport, setSalesReport] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [inventorySearch, setInventorySearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [ordersSearch, setOrdersSearch] = useState('')
  const [reviewsSearch, setReviewsSearch] = useState('')
  const [deletingReview, setDeletingReview] = useState(null)

  const loadOverview = async () => {
    const result = await api('/admin/overview')
    setOverview(result)
    setAdmin(true)
  }

  useEffect(() => {
    api('/admin/session')
      .then(({ authenticated }) => authenticated ? loadOverview() : undefined)
      .catch((loadError) => {
        setError(loadError.message)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!admin) return undefined
    let cancelled = false
    setReportLoading(true)
    api(`/admin/reports/sales?days=${salesPeriod}`)
      .then((report) => {
        if (!cancelled) setSalesReport(report)
      })
      .catch((reportError) => {
        if (!cancelled) setError(reportError.message)
      })
      .finally(() => {
        if (!cancelled) setReportLoading(false)
      })
    return () => { cancelled = true }
  }, [admin, salesPeriod])

  const login = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/admin/login', { method: 'POST', body: { email, password } })
      setPassword('')
      await loadOverview()
    } catch (loginError) {
      setError(loginError.message)
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    try {
      await api('/admin/logout', { method: 'POST' })
      setAdmin(false)
      setOverview(null)
    } catch (logoutError) {
      setError(logoutError.message)
    }
  }

  const updateOrderStatus = async (orderId, status) => {
    setUpdatingOrder(orderId)
    setError('')
    try {
      const result = await api(`/admin/orders/${encodeURIComponent(orderId)}/status`, { method: 'PATCH', body: { status } })
      setOverview((current) => ({
        ...current,
        orders: current.orders.map((order) => order.orderId === orderId ? { ...order, status: result.status } : order)
      }))
      setOrderNotifications((current) => ({ ...current, [orderId]: result.notification }))
      if (result.notification?.sent === false) setError(result.notification.error)
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setUpdatingOrder('')
    }
  }

  const confirmManualPayment = async (orderId) => {
    setUpdatingOrder(orderId)
    setError('')
    try {
      const result = await api(`/admin/orders/${encodeURIComponent(orderId)}/confirm-manual-payment`, { method: 'POST' })
      setOverview((current) => ({
        ...current,
        orders: current.orders.map((order) => order.orderId === orderId
          ? { ...order, paymentStatus: result.paymentStatus, paymentReference: '' }
          : order)
      }))
      setOrderNotifications((current) => ({ ...current, [orderId]: result.notification }))
      if (result.notification?.sent === false) setError(result.notification.error)
    } catch (confirmError) {
      setError(confirmError.message)
    } finally {
      setUpdatingOrder('')
    }
  }

  const updateInventoryField = (bookId, field, value) => {
    setOverview((current) => ({
      ...current,
      inventory: current.inventory.map((book) => book.id === bookId ? { ...book, [field]: value } : book)
    }))
  }

  const deleteReview = async (review) => {
    if (!window.confirm(`Permanently remove this review for "${review.bookTitle}"?`)) return
    setDeletingReview(review.id)
    setError('')
    try {
      await api(`/admin/reviews/${review.id}`, { method: 'DELETE' })
      setOverview((current) => ({
        ...current,
        reviews: current.reviews.filter((item) => item.id !== review.id),
        reviewCount: Math.max(0, current.reviewCount - 1)
      }))
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setDeletingReview(null)
    }
  }

  const lookupBook = async (book) => {
    setLookingUpBook(book.id)
    setError('')
    try {
      const metadata = await api(`/admin/books/${encodeURIComponent(book.id)}/lookup?isbn=${encodeURIComponent(book.isbn || '')}`)
      setOverview((current) => ({
        ...current,
        inventory: current.inventory.map((item) => item.id === book.id ? { ...item, ...metadata } : item)
      }))
    } catch (lookupError) {
      setError(lookupError.message)
    } finally {
      setLookingUpBook('')
    }
  }

  const saveInventory = async (book) => {
    setUpdatingBook(book.id)
    setError('')
    try {
      const saved = await api(`/admin/books/${encodeURIComponent(book.id)}`, {
        method: 'PATCH',
        body: {
          title: book.title,
          author: book.author,
          category: book.category,
          price: Number(book.price),
          stock: Number(book.stock),
          isbn: book.isbn,
          publisher: book.publisher,
          publicationYear: book.publicationYear || null,
          language: book.language,
          pages: book.pages || null,
          format: book.format,
          inventoryVerified: book.inventoryVerified === true
        }
      })
      setOverview((current) => ({
        ...current,
        inventory: current.inventory.map((item) => item.id === book.id ? saved : item),
        unverifiedInventoryCount: current.inventory.filter((item) => item.id !== book.id && !item.inventoryVerified).length + (saved.inventoryVerified ? 0 : 1)
      }))
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setUpdatingBook('')
    }
  }

  const createShipment = async (orderId) => {
    setUpdatingOrder(orderId)
    setError('')
    try {
      const shipment = await api(`/admin/orders/${encodeURIComponent(orderId)}/shipment`, { method: 'POST' })
      setOverview((current) => ({
        ...current,
        orders: current.orders.map((order) => order.orderId === orderId ? { ...order, ...shipment, trackingStatus: 'Shipment created' } : order)
      }))
      setOrderNotifications((current) => ({ ...current, [orderId]: shipment.notification }))
    } catch (shipmentError) {
      setError(shipmentError.message)
    } finally {
      setUpdatingOrder('')
    }
  }

  const retryOrderNotification = async (orderId, eventKey) => {
    setUpdatingOrder(orderId)
    setError('')
    try {
      const result = await api(`/admin/orders/${encodeURIComponent(orderId)}/notifications/${encodeURIComponent(eventKey)}`, { method: 'POST' })
      setOrderNotifications((current) => ({ ...current, [orderId]: result.notification }))
    } catch (notificationError) {
      setError(notificationError.message)
    } finally {
      setUpdatingOrder('')
    }
  }

  const updateReturn = async (returnRequest, status) => {
    setUpdatingReturn(returnRequest.id)
    setError('')
    try {
      const updated = await api(`/admin/returns/${returnRequest.id}`, { method: 'PATCH', body: { status } })
      setOverview((current) => ({
        ...current,
        returns: current.returns.map((item) => item.id === returnRequest.id ? { ...item, ...updated } : item)
      }))
    } catch (returnError) {
      setError(returnError.message)
    } finally {
      setUpdatingReturn('')
    }
  }

  const nextStatus = { placed: 'packed', packed: 'shipped', shipped: 'delivered' }
  const nextReturnStatus = { requested: ['approved', 'rejected'], approved: ['received'], received: ['refunded'] }
  const filteredInventory = useMemo(() => {
    const query = inventorySearch.trim().toLowerCase()
    return overview?.inventory.filter((book) => {
      const matchesQuery = !query || `${book.title} ${book.author} ${book.category} ${book.isbn}`.toLowerCase().includes(query)
      return matchesQuery && (!lowStockOnly || book.stock <= 5)
    }) || []
  }, [inventorySearch, lowStockOnly, overview])
  const filteredOrders = useMemo(() => {
    const query = ordersSearch.trim().toLowerCase()
    return overview?.orders.filter((order) => !query || [
      order.orderId, order.recipientName, order.accountName, order.recipientEmail, order.accountEmail, order.paymentStatus
    ].some((value) => String(value || '').toLowerCase().includes(query))) || []
  }, [ordersSearch, overview])
  const filteredReviews = useMemo(() => {
    const query = reviewsSearch.trim().toLowerCase()
    return overview?.reviews.filter((review) => !query || [
      review.bookTitle, review.customerName, review.customerEmail, review.review
    ].some((value) => String(value || '').toLowerCase().includes(query))) || []
  }, [overview, reviewsSearch])
  const lowStockCount = overview?.inventory.filter((book) => book.stock <= 5).length || 0

  if (loading) return <main className="admin-page"><p>Loading admin dashboard…</p></main>

  if (!admin) {
    return (
      <main className="admin-page">
        <form className="admin-login" onSubmit={login}>
          <a className="admin-brand" href="/">BookStore Admin</a>
          <h1>Private admin sign in</h1>
          <p>Customer and order information is restricted to authorized administrators.</p>
          <label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="btn-primary-large" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <a className="admin-home-link" href="/">Back to store</a>
        </form>
      </main>
    )
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div><a className="admin-brand" href="/">BookStore Admin</a><span>Private customer & order dashboard</span></div>
        <button type="button" className="section-nav-btn" onClick={logout}>Sign out</button>
      </header>

      <section className="admin-metrics">
        <article><span>Total customers</span><strong>{overview.customerCount}</strong></article>
        <article><span>Total orders</span><strong>{overview.orderCount}</strong></article>
        <article><span>Paid revenue</span><strong>₹{overview.paidRevenue}</strong></article>
        <article><span>Inventory needs verification</span><strong>{overview.unverifiedInventoryCount}</strong></article>
        <article><span>Low stock (5 or fewer)</span><strong>{lowStockCount}</strong></article>
        <article><span>Customer reviews</span><strong>{overview.reviewCount}</strong></article>
      </section>

      {error && <p className="auth-error" role="alert">{error}</p>}
      <section className="admin-section">
        <div className="admin-section-heading">
          <div><h2>Sales report</h2><p>Paid orders only; refunds are not deducted from the revenue total.</p></div>
          <label className="admin-report-period">Period
            <select value={salesPeriod} onChange={(event) => setSalesPeriod(Number(event.target.value))}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>
        </div>
        {reportLoading && !salesReport ? <div className="admin-empty">Loading sales report…</div> : salesReport && (
          <>
            <div className="admin-report-metrics">
              <article><span>Paid revenue</span><strong>₹{salesReport.revenue}</strong></article>
              <article><span>Paid orders</span><strong>{salesReport.orderCount}</strong></article>
              <article><span>Average order value</span><strong>₹{salesReport.averageOrderValue}</strong></article>
            </div>
            {salesReport.daily.length ? (
              <div className="admin-sales-chart" role="img" aria-label={`Daily paid revenue for the last ${salesReport.days} days`}>
                {salesReport.daily.map((day) => {
                  const maxRevenue = Math.max(...salesReport.daily.map((item) => item.revenue), 1)
                  return (
                    <div className="admin-sales-day" key={day.date} title={`${day.date}: ₹${day.revenue}, ${day.orderCount} orders`}>
                      <span className="admin-sales-bar" style={{ height: `${Math.max(4, day.revenue / maxRevenue * 100)}%` }} />
                      <strong>₹{day.revenue}</strong>
                      <small>{new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small>
                    </div>
                  )
                })}
              </div>
            ) : <div className="admin-empty">No paid sales in this period.</div>}
          </>
        )}
      </section>
      <section className="admin-section">
        <h1>Recent orders</h1>
        <p>Latest 100 orders, including payment state and delivery details.</p>
        <label className="admin-search">Search order, customer, email, or payment state
          <input value={ordersSearch} onChange={(event) => setOrdersSearch(event.target.value)} placeholder="Filter recent orders" />
        </label>
        {!filteredOrders.length ? <div className="admin-empty">{overview.orders.length ? 'No matching orders.' : 'No orders yet.'}</div> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Payment</th><th>Fulfillment</th><th>Total</th><th>Delivery address</th><th>Items</th><th>Date</th></tr></thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.orderId}>
                    <td><strong>{order.orderId}</strong><small>{order.status}</small></td>
                    <td>{order.recipientName || order.accountName}<small>{order.recipientEmail || order.accountEmail}</small><small>{order.recipientPhone || order.accountPhone}</small></td>
                    <td>
                      <span className={`admin-payment-status ${order.paymentStatus}`}>{order.paymentStatus}</span>
                      {order.paymentMethod === 'phonepe_qr' && <small>UPI reference: {order.paymentReference || 'not provided'}</small>}
                      {order.paymentMethod === 'phonepe_qr' && order.paymentStatus === 'pending' && order.paymentReference && (
                        <button
                          type="button"
                          className="admin-action-btn"
                          disabled={updatingOrder === order.orderId}
                          onClick={() => confirmManualPayment(order.orderId)}
                        >
                          {updatingOrder === order.orderId ? 'Verifying…' : 'Confirm PhonePe payment'}
                        </button>
                      )}
                      {order.paymentMethod === 'cod' && order.paymentStatus === 'cod_pending' && order.status === 'delivered' && (
                        <button
                          type="button"
                          className="admin-action-btn"
                          disabled={updatingOrder === order.orderId}
                          onClick={() => confirmManualPayment(order.orderId)}
                        >
                          {updatingOrder === order.orderId ? 'Confirming…' : 'Confirm cash collected'}
                        </button>
                      )}
                    </td>
                    <td>
                      {['paid', 'cod_pending'].includes(order.paymentStatus) && nextStatus[order.status]
                        ? <select className="admin-status-select" aria-label={`Update ${order.orderId} fulfillment status`} value={order.status} disabled={updatingOrder === order.orderId} onChange={(event) => updateOrderStatus(order.orderId, event.target.value)}>
                            <option value={order.status}>{order.status}</option>
                            <option value={nextStatus[order.status]}>{nextStatus[order.status]}</option>
                          </select>
                        : order.status}
                      {['paid', 'cod_pending'].includes(order.paymentStatus) && ['packed', 'shipped'].includes(order.status) && !order.trackingNumber && (
                        <button type="button" className="admin-action-btn" disabled={!overview.shippingEnabled || updatingOrder === order.orderId} onClick={() => createShipment(order.orderId)}>
                          {updatingOrder === order.orderId ? 'Creating…' : 'Create Shiprocket shipment'}
                        </button>
                      )}
                      {order.trackingNumber && <small>{order.courierName || 'Courier'} • AWB {order.trackingNumber}</small>}
                      {order.trackingStatus && <small>{order.trackingStatus}</small>}
                      {order.trackingUrl && <a href={order.trackingUrl} target="_blank" rel="noreferrer">Track shipment</a>}
                      {orderNotifications[order.orderId] && (
                        <small role="status" className={orderNotifications[order.orderId].sent ? 'admin-email-sent' : 'admin-email-failed'}>
                          {orderNotifications[order.orderId].sent
                            ? `Email update sent: ${orderNotifications[order.orderId].eventKey.replaceAll('_', ' ')}`
                            : orderNotifications[order.orderId].error}
                        </small>
                      )}
                      {orderNotifications[order.orderId] && !orderNotifications[order.orderId].sent && (
                        <button
                          type="button"
                          className="admin-action-btn"
                          disabled={updatingOrder === order.orderId}
                          onClick={() => retryOrderNotification(order.orderId, orderNotifications[order.orderId].eventKey)}
                        >
                          {updatingOrder === order.orderId ? 'Sending…' : 'Retry customer email'}
                        </button>
                      )}
                      {order.returnRequest && <small>Return: {order.returnRequest.status} — {order.returnRequest.reason}</small>}
                    </td>
                    <td>₹{order.total}</td>
                    <td>{order.addressLine1 && <>{order.addressLine1}{order.addressLine2 && `, ${order.addressLine2}`}<br />{order.city}, {order.state} {order.postalCode}</>}</td>
                    <td>{order.items.map((item) => <small key={`${order.orderId}-${item.id}`}>{item.title} × {item.qty}</small>)}</td>
                    <td>{new Date(order.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-section">
        <h2>Books and stock</h2>
        <p>Edit catalog details and stock. Confirm a physical count before marking inventory verified or relying on it for fulfillment. ISBN metadata is a suggestion from Open Library; review it before saving.</p>
        <div className="admin-inventory-tools">
          <label className="admin-search">Search title, author, category, or ISBN
            <input value={inventorySearch} onChange={(event) => setInventorySearch(event.target.value)} placeholder="Filter catalog" />
          </label>
          <label className="admin-low-stock-toggle"><input type="checkbox" checked={lowStockOnly} onChange={(event) => setLowStockOnly(event.target.checked)} /> Show low stock only (≤ 5)</label>
          <span>{filteredInventory.length} of {overview.inventory.length} books</span>
        </div>
        {!filteredInventory.length ? <div className="admin-empty">No matching books found.</div> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Book details</th><th>Price</th><th>ISBN</th><th>Stock</th><th>Publisher</th><th>Year / pages</th><th>Language / format</th><th>Verification</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredInventory.map((book) => (
                  <tr key={book.id}>
                    <td>
                      <input aria-label={`Title for ${book.title}`} value={book.title} onChange={(event) => updateInventoryField(book.id, 'title', event.target.value)} />
                      <input aria-label={`Author for ${book.title}`} value={book.author} onChange={(event) => updateInventoryField(book.id, 'author', event.target.value)} />
                      <input aria-label={`Category for ${book.title}`} value={book.category} onChange={(event) => updateInventoryField(book.id, 'category', event.target.value)} />
                    </td>
                    <td><input aria-label={`Price for ${book.title}`} type="number" min="0" max="1000000" step="1" value={book.price} onChange={(event) => updateInventoryField(book.id, 'price', event.target.value)} /></td>
                    <td><input aria-label={`ISBN for ${book.title}`} value={book.isbn || ''} onChange={(event) => updateInventoryField(book.id, 'isbn', event.target.value)} /></td>
                    <td><input className={book.stock <= 5 ? 'admin-low-stock' : ''} aria-label={`Stock count for ${book.title}`} type="number" min="0" step="1" value={book.stock} onChange={(event) => updateInventoryField(book.id, 'stock', event.target.value)} />{book.stock <= 5 && <small className="admin-stock-warning">Low stock</small>}</td>
                    <td><input aria-label={`Publisher for ${book.title}`} value={book.publisher || ''} onChange={(event) => updateInventoryField(book.id, 'publisher', event.target.value)} /></td>
                    <td>
                      <input aria-label={`Publication year for ${book.title}`} type="number" min="1000" max="2100" value={book.publicationYear || ''} onChange={(event) => updateInventoryField(book.id, 'publicationYear', event.target.value)} />
                      <input aria-label={`Page count for ${book.title}`} type="number" min="1" value={book.pages || ''} onChange={(event) => updateInventoryField(book.id, 'pages', event.target.value)} />
                    </td>
                    <td>
                      <input aria-label={`Language for ${book.title}`} value={book.language || ''} onChange={(event) => updateInventoryField(book.id, 'language', event.target.value)} />
                      <input aria-label={`Format for ${book.title}`} value={book.format || ''} onChange={(event) => updateInventoryField(book.id, 'format', event.target.value)} />
                    </td>
                    <td><label><input type="checkbox" checked={Boolean(book.inventoryVerified)} onChange={(event) => updateInventoryField(book.id, 'inventoryVerified', event.target.checked)} /> Count confirmed</label></td>
                    <td>
                      <button type="button" className="admin-action-btn" disabled={!book.isbn || lookingUpBook === book.id} onClick={() => lookupBook(book)}>{lookingUpBook === book.id ? 'Looking up…' : 'Lookup ISBN'}</button>
                      <button type="button" className="admin-action-btn" disabled={updatingBook === book.id} onClick={() => saveInventory(book)}>{updatingBook === book.id ? 'Saving…' : 'Save book'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-section">
        <h2>Review management</h2>
        <p>Latest 200 verified-purchase reviews. Removing a review is permanent.</p>
        <label className="admin-search">Search book, reviewer, or review text
          <input value={reviewsSearch} onChange={(event) => setReviewsSearch(event.target.value)} placeholder="Filter reviews" />
        </label>
        {!filteredReviews.length ? <div className="admin-empty">{overview.reviewCount ? 'No matching reviews.' : 'No reviews yet.'}</div> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Book</th><th>Reviewer</th><th>Rating</th><th>Review</th><th>Date</th><th>Action</th></tr></thead>
              <tbody>
                {filteredReviews.map((review) => (
                  <tr key={review.id}>
                    <td>{review.bookTitle}</td>
                    <td>{review.customerName}<small>{review.customerEmail}</small></td>
                    <td>{review.rating} / 5</td>
                    <td className="admin-review-text">{review.review}</td>
                    <td>{new Date(`${review.createdAt}Z`).toLocaleDateString()}</td>
                    <td><button type="button" className="admin-action-btn admin-danger-btn" disabled={deletingReview === review.id} onClick={() => deleteReview(review)}>{deletingReview === review.id ? 'Removing…' : 'Remove review'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-section">
        <h2>Return requests</h2>
        <p>Refund actions submit the full order total through the configured Razorpay account; review the order and return condition first.</p>
        {!overview.returns.length ? <div className="admin-empty">No return requests yet.</div> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Reason</th><th>Refund</th><th>Actions</th></tr></thead>
              <tbody>
                {overview.returns.map((item) => (
                  <tr key={item.id}>
                    <td>{item.orderId}<small>₹{item.total}</small></td>
                    <td>{item.customerName}<small>{item.customerEmail}</small></td>
                    <td>{item.reason}</td>
                    <td>{item.status}{item.refundId && <small>{item.refundStatus}: {item.refundId}</small>}</td>
                    <td>{(nextReturnStatus[item.status] || []).map((status) => (
                      <button key={status} type="button" className="admin-action-btn" disabled={updatingReturn === item.id} onClick={() => updateReturn(item, status)}>
                        {updatingReturn === item.id ? 'Updating…' : status === 'refunded' ? 'Issue full refund' : status}
                      </button>
                    ))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-section">
        <h2>Customers</h2>
        <p>Latest 200 registered accounts with contact details and order counts.</p>
        {!overview.customers.length ? <div className="admin-empty">No customers yet.</div> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>City</th><th>Orders</th><th>Joined</th></tr></thead>
              <tbody>
                {overview.customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.name}</td><td>{customer.email}</td><td>{customer.phone || '—'}</td>
                    <td>{customer.city || '—'}</td><td>{customer.orderCount}</td>
                    <td>{new Date(`${customer.createdAt}Z`).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="admin-privacy-note">Keep admin credentials private and collect/use customer information only to manage orders and provide customer support.</p>
    </main>
  )
}

export default AdminDashboard
