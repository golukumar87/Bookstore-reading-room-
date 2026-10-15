import React, { useEffect, useMemo, useState } from 'react'
import { api } from './api'

import './App.css'

import Header from './components/Header'
import HeroSection from './components/HeroSection'

import CategorySection from './components/CategorySection'
import BookCard from './components/BookCard'
import Footer from './components/Footer'
import Popup from './components/Popup'
import ProfileModal from './components/ProfileModal'
import TrackOrderModal from './components/TrackOrderModal'

import SectionNav from './components/SectionNav'
import AboutSection from './components/AboutSection'
import Features from './components/Features'
import AdminDashboard from './components/AdminDashboard'

import CartDrawer from './components/CartDrawer'
import BookDetailsModal from './components/BookDetailsModal'
import BookImageDetailsModal from './components/BookImageDetailsModal'

import ToastStack from './components/ToastStack'
import AuthModal from './components/AuthModal'
import CheckoutModal from './components/CheckoutModal'
import ReadingLibrary from './components/ReadingLibrary'
import BookReader from './components/BookReader'
import readerCatalog from './readerCatalog'
import { readLocalReaderState } from './readerState'
import { getReadBasedRecommendations } from './readingLibrary'
import { useAccessibility } from './accessibility'

function readRouteFromPath(pathname) {
  if (/^\/read\/?$/.test(pathname)) return { panel: 'read', bookId: '' }
  const match = pathname.match(/^\/read\/([^/]+)\/?$/)
  if (!match) return { panel: 'home', bookId: '' }
  try {
    return { panel: 'reader', bookId: decodeURIComponent(match[1]) }
  } catch {
    return { panel: 'reader', bookId: '' }
  }
}

function normalizeBookTitle(title = '') {
  return title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function App() {
  const { t } = useAccessibility()
  const initialReadRoute = readRouteFromPath(window.location.pathname)
  const [authUser, setAuthUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authDismissed, setAuthDismissed] = useState(false)
  const [otpChallenge, setOtpChallenge] = useState(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [apiError, setApiError] = useState('')
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [trackOpen, setTrackOpen] = useState(false)
  const [trackOrderId, setTrackOrderId] = useState(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [cardPaymentEnabled, setCardPaymentEnabled] = useState(false)
  const [paymentMode, setPaymentMode] = useState('disabled')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [activeBook, setActiveBook] = useState(null)
  const [imageDetailsOpen, setImageDetailsOpen] = useState(false)
  const [activeBookForImageDetails, setActiveBookForImageDetails] = useState(null)
  const [toasts, setToasts] = useState([])
  const [panelOpen, setPanelOpen] = useState(initialReadRoute.panel)
  const [readerBookId, setReaderBookId] = useState(initialReadRoute.bookId)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [wishlistOnly, setWishlistOnly] = useState(false)
  const [sortMode, setSortMode] = useState('featured')
  const [cart, setCart] = useState([])
  const [orders, setOrders] = useState([])
  const [orderRecommendations, setOrderRecommendations] = useState([])
  const [accountReadBookIds, setAccountReadBookIds] = useState([])
  const [wishlist, setWishlist] = useState([])
  const [profile, setProfile] = useState(null)
  const [books, setBooks] = useState([])
  const [offerEligible, setOfferEligible] = useState(false)
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0)
  const readingEntries = useMemo(() => readerCatalog
    .map((reader) => {
      const catalogBook = books.find((book) => book.id === reader.bookId)
      const titleMatch = reader.title
        ? books.find((book) => normalizeBookTitle(book.title) === normalizeBookTitle(reader.title))
        : null
      if (catalogBook) return { reader, book: catalogBook, purchaseBook: catalogBook }
      if (!reader.title) return null
      return {
        reader,
        purchaseBook: titleMatch || null,
        book: {
          id: reader.bookId,
          title: reader.title,
          author: reader.author,
          category: reader.category || 'Free reading',
          image: reader.image
        }
      }
    })
    .filter(Boolean), [books])
  const recommendedReadEntries = useMemo(() => orderRecommendations
    .map((book) => readingEntries.find((entry) => entry.book.id === book.id))
    .filter(Boolean), [orderRecommendations, readingEntries])
  const readingHistoryRecommendations = useMemo(() => {
    const scope = authUser?.id ? String(authUser.id) : 'guest'
    const readBookIds = new Set(accountReadBookIds)
    readingEntries.forEach(({ book }) => {
      const state = readLocalReaderState(book.id, scope)
      if (state.position > 0 || state.paragraphPosition > 0) readBookIds.add(book.id)
    })
    return getReadBasedRecommendations(readingEntries, readBookIds)
  }, [accountReadBookIds, authUser?.id, panelOpen, readingEntries])
  const readerByBookId = useMemo(() => new Map(readerCatalog.map((reader) => [reader.bookId, reader])), [])
  const activeReaderBook = readingEntries.find(({ book }) => book.id === readerBookId)?.book
    || books.find((book) => book.id === readerBookId)
  const activeReader = readerByBookId.get(readerBookId)

  useEffect(() => {
    const syncRoute = () => {
      const route = readRouteFromPath(window.location.pathname)
      setPanelOpen(route.panel)
      setReaderBookId(route.bookId)
    }
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!authUser?.id) {
      setAccountReadBookIds([])
      return () => { cancelled = true }
    }
    setAccountReadBookIds([])
    api('/reading/history')
      .then(({ bookIds }) => {
        if (!cancelled) setAccountReadBookIds(Array.isArray(bookIds) ? bookIds : [])
      })
      .catch((error) => {
        if (!cancelled) console.error('Could not load account reading history:', error)
      })
    return () => { cancelled = true }
  }, [authUser?.id])

  const pushToast = ({ title, message, variant, duration, actionLabel, onAction }) => {
    const id = Math.random().toString(16).slice(2)
    setToasts((prev) => [{ id, title, message, variant: variant ?? 'info', duration, actionLabel, onAction }, ...prev].slice(0, 4))
    return id
  }

  const requestLogin = (message = 'Log in or create an account to save this to your account.') => {
    setAuthError(message)
    setAuthDismissed(false)
  }

  const dismissToast = (id) => {
    if (cartSnapshotToastRef.current === id) {
      cartSnapshotRef.current = null
      cartSnapshotToastRef.current = null
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }


  const cartSnapshotRef = React.useRef(null)
  const cartSnapshotToastRef = React.useRef(null)
  const isWishlisted = (bookId) => wishlist.includes(bookId)

  const loadAccount = async () => {
    const [savedCart, savedWishlist, savedProfile, savedOrders, savedOffer] = await Promise.all([
      api('/cart'),
      api('/wishlist'),
      api('/profile'),
      api('/orders'),
      api('/offer')
    ])
    setCart(savedCart)
    setWishlist(savedWishlist)
    setProfile(savedProfile)
    setOrders(savedOrders)
    setOfferEligible(savedOffer.eligible)
    const purchasedIds = [...new Set(savedOrders
      .filter((order) => order.paymentStatus === 'paid')
      .flatMap((order) => order.items.map((item) => item.id)))]
    if (purchasedIds.length) {
      try {
        setOrderRecommendations(await api(`/recommendations?bookIds=${encodeURIComponent(purchasedIds.slice(0, 20).join(','))}`))
      } catch (error) {
        console.error('Could not load purchase-based recommendations:', error)
      }
    } else {
      setOrderRecommendations([])
    }
    if (!savedOffer.claimed && savedOrders.length === 0 && !sessionStorage.getItem('bs_offer_dismissed')) {
      setWelcomeOpen(true)
    }
  }

  useEffect(() => {
    let cancelled = false
    api('/books')
      .then((catalog) => {
        if (!cancelled) setBooks(catalog)
      })
      .catch((error) => {
        if (!cancelled) {
          setApiError(`Backend unavailable: ${error.message}`)
          setLoadingBooks(false)
        }
      })
    api('/payments/config')
      .then((config) => {
        if (!cancelled) {
          setCardPaymentEnabled(config.cardEnabled)
          setPaymentMode(config.mode)
        }
      })
      .catch((error) => {
        if (!cancelled) setApiError(`Payment configuration unavailable: ${error.message}`)
      })
    api('/auth/me')
      .then(async ({ user }) => {
        if (cancelled) return
        if (user) {
          await loadAccount()
          if (!cancelled) setAuthUser(user)
        }
      })
      .catch((error) => {
        if (!cancelled) setApiError(`Backend unavailable: ${error.message}`)
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const completeAuthentication = async (response, avatar) => {
    await loadAccount()
    setAuthUser(response.user)
    setAuthDismissed(false)
    setOtpChallenge(null)
    if (avatar) {
      try {
        const updatedProfile = await api('/profile', {
          method: 'PUT',
          body: {
            name: response.user.name,
            phone: response.user.phone,
            city: response.user.city,
            avatar
          }
        })
        setProfile(updatedProfile)
        setAuthUser(updatedProfile)
      } catch (error) {
        pushToast({ title: 'Photo not saved', message: error.message, variant: 'error' })
      }
    }
  }

  const submitAuth = async (form) => {
    setAuthBusy(true)
    setAuthError('')
    setApiError('')
    try {
      const response = await api(`/auth/${form.mode === 'register' ? 'register' : 'login'}`, {
        method: 'POST',
        body: form
      })
      if (response.otpRequired) {
        setOtpChallenge(response)
        return
      }
      await completeAuthentication(response, form.mode === 'login' ? form.avatar : null)
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setAuthBusy(false)
    }
  }

  const verifyAuthOtp = async ({ challengeId, code, avatar }) => {
    setAuthBusy(true)
    setAuthError('')
    try {
      const response = await api('/auth/login/verify', {
        method: 'POST',
        body: { challengeId, code }
      })
      await completeAuthentication(response, avatar)
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setAuthBusy(false)
    }
  }

  const resendAuthOtp = async (challengeId) => {
    setAuthBusy(true)
    setAuthError('')
    try {
      setOtpChallenge(await api('/auth/login/resend', {
        method: 'POST',
        body: { challengeId }
      }))
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setAuthBusy(false)
    }
  }

  const signOut = async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
      setAuthUser(null)
      setCart([])
      setWishlist([])
      setProfile(null)
      setOrders([])
      setOrderRecommendations([])
      setOfferEligible(false)
      setWelcomeOpen(false)
      setTrackOpen(false)
      setProfileOpen(false)
      setCartOpen(false)
      pushToast({ title: 'Logged out', message: 'You have safely signed out.', variant: 'success' })
    } catch (error) {
      pushToast({ title: 'Could not log out', message: error.message, variant: 'error' })
    }
  }

  const openCustomerOrders = async () => {
    if (!authUser) {
      requestLogin('Log in or create an account to view your orders.')
      return
    }
    try {
      setOrders(await api('/orders'))
      setTrackOrderId(null)
      setPanelOpen('orders')
    } catch (error) {
      pushToast({ title: 'Could not load orders', message: error.message, variant: 'error' })
    }
  }

  const visibleBooks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const filteredBooks = books.filter((book) => {
      const matchesQuery = !query || `${book.title} ${book.author}`.toLowerCase().includes(query)
      const matchesCategory = !categoryFilter || book.category === categoryFilter
      const matchesWishlist = !wishlistOnly || wishlist.includes(book.id)
      return matchesQuery && matchesCategory && matchesWishlist
    })
    return sortMode === 'rating'
      ? filteredBooks.slice().sort((first, second) => second.rating - first.rating)
      : filteredBooks
  }, [books, searchQuery, categoryFilter, wishlistOnly, wishlist, sortMode])

  const cartRecommendations = useMemo(() => {
    if (!cart.length) return []
    if (orderRecommendations.length) return orderRecommendations.slice(0, 3)
    const cartIds = new Set(cart.map((item) => item.id))
    const cartBooks = books.filter((book) => cartIds.has(book.id))
    const categories = new Set(cartBooks.map((book) => book.category))
    const authors = new Set(cartBooks.map((book) => book.author))
    return books
      .filter((book) => !cartIds.has(book.id) && (categories.has(book.category) || authors.has(book.author)))
      .sort((first, second) => {
        const firstScore = (categories.has(first.category) ? 2 : 0) + (authors.has(first.author) ? 1 : 0)
        const secondScore = (categories.has(second.category) ? 2 : 0) + (authors.has(second.author) ? 1 : 0)
        return secondScore - firstScore || second.rating - first.rating
      })
      .slice(0, 3)
  }, [books, cart, orderRecommendations])

  const cartSubtotal = cart.reduce((sum, item) => sum + item.qty * (item.unitPrice ?? 0), 0)
  const cartDiscount = offerEligible ? Math.round(cartSubtotal * 0.2) : 0
  const cartTotal = cartSubtotal - cartDiscount

  const [loadingBooks, setLoadingBooks] = useState(true)

  useEffect(() => {
    if (books.length) setLoadingBooks(false)
  }, [books])

  const saveCart = async (items) => {
    if (!authUser) {
      requestLogin('Log in or create an account to add books to your cart.')
      return false
    }
    try {
      const savedCart = await api('/cart', {
        method: 'PUT',
        body: { items: items.map((item) => ({ id: item.id, qty: item.qty })) }
      })
      setCart(savedCart)
      return true
    } catch (error) {
      pushToast({ title: 'Cart update failed', message: error.message, variant: 'error' })
      return false
    }
  }

  const addToCart = async (book) => {
    const existing = cart.find((item) => item.id === book.id)
    const next = existing
      ? cart.map((item) => item.id === book.id ? { ...item, qty: item.qty + 1 } : item)
      : [...cart, { ...book, unitPrice: book.unitPrice, unitPriceDisplay: book.unitPriceDisplay, qty: 1 }]
    if (await saveCart(next)) {
      pushToast({ title: 'Added to cart', message: book.title, variant: 'success' })
      return true
    }
    return false
  }

  const incQty = (id) => {
    const next = cart.map((item) => item.id === id ? { ...item, qty: item.qty + 1 } : item)
    void saveCart(next)
  }

  const decQty = (id) => {
    const next = cart.flatMap((item) => item.id !== id ? [item] : item.qty <= 1 ? [] : [{ ...item, qty: item.qty - 1 }])
    void saveCart(next)
  }

  const removeItem = async (id) => {
    if (await saveCart(cart.filter((item) => item.id !== id))) {
      pushToast({ title: 'Removed', message: 'Item removed from cart', variant: 'info' })
    }
  }

  const clearCartWithUndo = async () => {
    if (!cart.length || !(await saveCart([]))) return
    cartSnapshotRef.current = cart
    cartSnapshotToastRef.current = pushToast({
      title: 'Cart cleared',
      message: 'Your items were removed.',
      variant: 'info',
      duration: 5000,
      actionLabel: 'Undo',
      onAction: async () => {
        const snapshot = cartSnapshotRef.current
        if (!snapshot) return
        if (await saveCart(snapshot)) {
          cartSnapshotRef.current = null
          pushToast({ title: 'Undo', message: 'Cart restored', variant: 'success' })
        }
      }
    })
  }

  const toggleWishlist = async (book) => {
    if (!book?.id) return false
    if (!authUser) {
      requestLogin('Log in or create an account to save books to your wishlist.')
      return false
    }
    const has = wishlist.includes(book.id)
    const ids = has ? wishlist.filter((id) => id !== book.id) : [book.id, ...wishlist]
    try {
      const savedWishlist = await api('/wishlist', { method: 'PUT', body: { ids } })
      setWishlist(savedWishlist)
      pushToast({
        title: has ? 'Removed from wishlist' : 'Saved to wishlist',
        message: book.title,
        variant: has ? 'info' : 'success'
      })
      return true
    } catch (error) {
      pushToast({ title: 'Wishlist update failed', message: error.message, variant: 'error' })
      return false
    }
  }

  const openBook = (book) => {
    setActiveBook(book)
    setDetailsOpen(true)
  }

  const openReadLibrary = () => {
    window.history.pushState({}, '', '/read')
    setReaderBookId('')
    setPanelOpen('read')
    setDetailsOpen(false)
    setImageDetailsOpen(false)
  }

  const openReader = (bookId) => {
    const reader = readerByBookId.get(bookId)
    if (!reader) return
    window.history.pushState({}, '', `/read/${encodeURIComponent(bookId)}`)
    setReaderBookId(bookId)
    setPanelOpen('reader')
    setDetailsOpen(false)
    setImageDetailsOpen(false)
    window.scrollTo(0, 0)
  }

  const returnToReadingLibrary = () => {
    window.history.pushState({}, '', '/read')
    setReaderBookId('')
    setPanelOpen('read')
  }

  const openPanel = (panel) => {
    if (panel === 'read') {
      openReadLibrary()
      return
    }
    if (window.location.pathname.startsWith('/read')) window.history.pushState({}, '', '/')
    setReaderBookId('')
    setPanelOpen(panel)
  }

  const buyNow = async (book) => {
    if (!(await addToCart(book))) return
    setDetailsOpen(false)
    setImageDetailsOpen(false)
    setCartOpen(true)
  }

  const dismissWelcome = () => {
    setWelcomeOpen(false)
    sessionStorage.setItem('bs_offer_dismissed', '1')
  }

  const claimWelcomeOffer = async () => {
    try {
      const offer = await api('/offer/claim', { method: 'POST' })
      setOfferEligible(offer.eligible)
      setWelcomeOpen(false)
      pushToast({ title: 'Offer claimed', message: 'Your 20% welcome discount will apply at checkout.', variant: 'success' })
    } catch (error) {
      pushToast({ title: 'Could not claim offer', message: error.message, variant: 'error' })
    }
  }

  const shareBook = async (book) => {
    const shareUrl = `${window.location.origin}/?book=${encodeURIComponent(book.id)}`
    try {
      if (navigator.share) {
        await navigator.share({ title: book.title, text: `Read ${book.title} by ${book.author}`, url: shareUrl })
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        pushToast({ title: 'Link copied', message: book.title, variant: 'success' })
      } else {
        pushToast({ title: 'Share this book', message: shareUrl, variant: 'info' })
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        pushToast({ title: 'Could not share', message: 'Please try again.', variant: 'error' })
      }
    }
  }

  const showBooks = (mode = 'featured') => {
    if (window.location.pathname.startsWith('/read')) window.history.pushState({}, '', '/')
    setReaderBookId('')
    setPanelOpen('home')
    setSearchQuery('')
    setCategoryFilter('')
    setWishlistOnly(false)
    setSortMode(mode)
    requestAnimationFrame(() => document.getElementById('featured-books')?.scrollIntoView({ behavior: 'smooth' }))
  }

  useEffect(() => {
    const onNavigationShortcut = (event) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key !== '1' && event.key !== '2') return
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement || target?.isContentEditable) return
      event.preventDefault()
      if (event.key === '1') showBooks('featured')
      else openPanel('read')
      requestAnimationFrame(() => document.getElementById('main-content')?.focus({ preventScroll: true }))
    }
    window.addEventListener('keydown', onNavigationShortcut)
    return () => window.removeEventListener('keydown', onNavigationShortcut)
  }, [])

  return (
    <div className="app">
      <a className="skip-to-content" href="#main-content">{t('Skip to content')}</a>
      {apiError && <div className="backend-error" role="alert">{apiError}</div>}
      {!authLoading && !authUser && !authDismissed && (
        <AuthModal
          onSubmit={submitAuth}
          onVerifyOtp={verifyAuthOtp}
          onResendOtp={resendAuthOtp}
          onCancelOtp={() => {
            setOtpChallenge(null)
            setAuthError('')
          }}
          challenge={otpChallenge}
          error={authError || apiError}
          busy={authBusy}
          onClose={() => {
            setAuthDismissed(true)
            setOtpChallenge(null)
            setAuthError('')
          }}
        />
      )}
      {welcomeOpen && (
        <Popup
          onClose={dismissWelcome}
          onClaim={claimWelcomeOffer}
        />
      )}
      {profileOpen && (
        <ProfileModal
          profile={profile}
          onSave={async (nextProfile) => {
            try {
              const savedProfile = await api('/profile', { method: 'PUT', body: nextProfile })
              setProfile(savedProfile)
              setAuthUser(savedProfile)
              setProfileOpen(false)
              pushToast({ title: 'Profile saved', message: 'Your details have been updated.', variant: 'success' })
            } catch (error) {
              pushToast({ title: 'Profile update failed', message: error.message, variant: 'error' })
            }
          }}
          onClose={() => setProfileOpen(false)}
        />
      )}
      {trackOpen && (
        <TrackOrderModal
          onClose={() => {
            setTrackOpen(false)
            setTrackOrderId(null)
          }}
          orderId={trackOrderId ?? undefined}
          orders={orders}
          onOrdersChanged={(orderId, updates) => setOrders((current) => current.map((order) => (
            order.orderId === orderId ? { ...order, ...updates } : order
          )))}
        />
      )}
      {panelOpen === 'orders' && (
        <TrackOrderModal
          pageMode
          onClose={() => {
            setPanelOpen('home')
            setTrackOrderId(null)
          }}
          orderId={trackOrderId ?? undefined}
          orders={orders}
          onOrdersChanged={(orderId, updates) => setOrders((current) => current.map((order) => (
            order.orderId === orderId ? { ...order, ...updates } : order
          )))}
        />
      )}


      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {checkoutOpen && (
        <CheckoutModal
          profile={profile}
          total={cartTotal}
          discount={cartDiscount}
          cardEnabled={cardPaymentEnabled}
          paymentMode={paymentMode}
          onCreateOrder={(shipping, payment) => api('/payments/order', {
            method: 'POST',
            body: { shipping, ...payment }
          })}
          onPaymentSuccess={async (paymentResult) => {
            const order = await api('/payments/verify', { method: 'POST', body: paymentResult })
            const purchased = new Map(order.items.map((item) => [item.id, item.qty]))
            setOrders((current) => [order, ...current.filter((savedOrder) => savedOrder.orderId !== order.orderId)])
            setCart((current) => current.flatMap((item) => {
              const remaining = item.qty - (purchased.get(item.id) || 0)
              return remaining > 0 ? [{ ...item, qty: remaining }] : []
            }))
            if (order.discount > 0) setOfferEligible(false)
            pushToast({
              title: 'Payment successful',
              message: `${order.orderId} • Order total ₹${order.total}`,
              variant: 'success'
            })
            if (order.notification?.sent === false) {
              pushToast({
                title: 'Order email not sent',
                message: order.notification.error,
                variant: 'error'
              })
            }
            setCheckoutOpen(false)
            setTrackOpen(true)
            setTrackOrderId(order.orderId)
          }}
          onManualPayment={async (order) => {
            const purchased = new Map(order.items.map((item) => [item.id, item.qty]))
            setOrders((current) => [order, ...current.filter((savedOrder) => savedOrder.orderId !== order.orderId)])
            setCart((current) => current.flatMap((item) => {
              const remaining = item.qty - (purchased.get(item.id) || 0)
              return remaining > 0 ? [{ ...item, qty: remaining }] : []
            }))
            pushToast({
              title: order.paymentMethod === 'cod' ? 'Cash on delivery order placed' : 'Payment submitted for verification',
              message: order.paymentMethod === 'cod'
                ? `${order.orderId} • ₹${order.total} due on delivery`
                : `${order.orderId} • UPI reference ${order.paymentReference}`,
              variant: 'success'
            })
            if (order.notification?.sent === false) {
              pushToast({
                title: 'Order email not sent',
                message: order.notification.error,
                variant: 'error'
              })
            }
            setCheckoutOpen(false)
            setTrackOpen(true)
            setTrackOrderId(order.orderId)
          }}
          onClose={() => setCheckoutOpen(false)}
        />
      )}

      <CartDrawer
        open={cartOpen}
        cartItems={cart}
        recommendations={cartRecommendations}
        onAddRecommended={addToCart}
        discountPercent={offerEligible ? 20 : 0}
        onClose={() => setCartOpen(false)}
        onInc={incQty}
        onDec={decQty}
        onRemove={removeItem}
        wishlistIds={wishlist}
        onMoveToWishlist={(item) => {
          const book = books.find((b) => b.id === item.id)
          if (!book) return
          if (isWishlisted(book.id)) {
            pushToast({ title: 'Already in wishlist', message: book.title, variant: 'info' })
            return
          }
          void (async () => {
            if (await toggleWishlist(book)) await removeItem(item.id)
          })()
        }}
        onClearCart={clearCartWithUndo}
        onCheckout={() => {
          setCartOpen(false)
          setCheckoutOpen(true)
        }}
      />



      {detailsOpen && (
        <BookDetailsModal
          book={activeBook}
          authUser={authUser}
          onNeedLogin={() => requestLogin('Log in with the account used for purchase to submit a verified review.')}
          onClose={() => setDetailsOpen(false)}
          onReadOnline={activeBook && readerByBookId.has(activeBook.id) ? (book) => openReader(book.id) : undefined}
          onAdd={(book) => {
            addToCart(book)
            setDetailsOpen(false)
          }}
        />
      )}

      {imageDetailsOpen && (
        <BookImageDetailsModal
          book={activeBookForImageDetails}
          onClose={() => {
            setImageDetailsOpen(false)
            setActiveBookForImageDetails(null)
          }}
          onAdd={(book) => {
            addToCart(book)
            setImageDetailsOpen(false)
          }}
          onBuy={buyNow}
          relatedBooks={
            activeBookForImageDetails
              ? books.filter(
                  (x) =>
                    x.id !== activeBookForImageDetails.id &&
                    (x.author === activeBookForImageDetails.author ||
                      x.title.split(' ')[0] === activeBookForImageDetails.title.split(' ')[0])
                )
              : []
          }
          onOpenRelated={(rb) => setActiveBookForImageDetails(rb)}
        />
      )}



      <Header
        cartCount={cartCount}
        books={books}
        user={authUser}
        onOpenHome={() => showBooks('featured')}
        onSearchQuery={(query) => {
          if (window.location.pathname.startsWith('/read')) window.history.pushState({}, '', '/')
          setReaderBookId('')
          setSearchQuery(query)
          setCategoryFilter('')
          setWishlistOnly(false)
          setSortMode('featured')
          setPanelOpen('home')
        }}
        onPickBook={(book) => {
          if (window.location.pathname.startsWith('/read')) window.history.pushState({}, '', '/')
          setReaderBookId('')
          setPanelOpen('home')
          setSearchQuery('')
          setCategoryFilter('')
          setWishlistOnly(false)
          setSortMode('featured')
          openBook(book)
        }}
        onOpenProfile={() => authUser ? setProfileOpen(true) : requestLogin('Log in or create an account to manage your profile.')}
        onOpenTrack={openCustomerOrders}
        onOpenCart={() => authUser ? setCartOpen(true) : requestLogin('Log in or create an account to view your cart.')}
        onOpenFeatures={() => openPanel('features')}
        onLogout={signOut}
      />

      {panelOpen !== 'reader' && <SectionNav activeId={panelOpen} onOpen={openPanel} />}


      {panelOpen === 'home' && (
        <>
          <HeroSection
            bookCount={books.length}
            onOpenSection={(id) => setPanelOpen(id)}
            onExplore={() => showBooks('featured')}
            onBestsellers={() => showBooks('rating')}
          />
          <CategorySection
            books={books}
            activeCategory={categoryFilter}
            onSelect={(category) => {
              setCategoryFilter(category)
              setSearchQuery('')
              setWishlistOnly(false)
              setSortMode('featured')
            }}
          />


          <section className="featured-books" id="featured-books">
            <div className="page-title-row">
              <h2>{t(wishlistOnly ? 'Your Wishlist' : categoryFilter ? `${categoryFilter} Books (${visibleBooks.length})` : searchQuery ? 'Books' : sortMode === 'rating' ? 'Top Rated Books' : 'Featured Books')}</h2>
              <div className="book-filters">
                <button
                  className={`section-nav-btn ${wishlistOnly ? 'active' : ''}`}
                  type="button"
                  onClick={() => {
                    setWishlistOnly((current) => !current)
                    setCategoryFilter('')
                  }}
                >
                  {t('Wishlist')} ({wishlist.length})
                </button>
                {(categoryFilter || searchQuery || wishlistOnly || sortMode !== 'featured') && (
                  <button
                    className="section-nav-btn"
                    type="button"
                    onClick={() => {
                      setCategoryFilter('')
                      setSearchQuery('')
                      setWishlistOnly(false)
                      setSortMode('featured')
                    }}
                  >
                    {t('Show all books')}
                  </button>
                )}
              </div>
            </div>
            {searchQuery &&             <p className="page-subtitle">{t('Search results for')} “{searchQuery}”</p>}
            {loadingBooks ? (
              <div className="book-grid">
                {Array.from({ length: 8 }).map((_, i) => (
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
            ) : (
              visibleBooks.length > 0 ? <div className="book-grid">
                {visibleBooks.map((b) => (
                  <BookCard
                    key={b.id}
                    id={b.id}
                    title={b.title}
                    author={b.author}
                    price={b.price}
                    image={b.image}
                    rating={b.rating}
                    onAdd={() => addToCart(b)}
                    onOpenDetails={() => openBook(b)}
                    onBuy={() => buyNow(b)}
                    onReadOnline={readerByBookId.has(b.id) ? () => openReader(b.id) : undefined}
                    onShare={() => shareBook(b)}
                    onToggleWishlist={toggleWishlist}
                    isWishlisted={isWishlisted(b.id)}
                    onOpenImage={({ title, author, price, image, rating }) => {
                      setActiveBookForImageDetails({ id: b.id, title, author, price, image, rating })
                      setImageDetailsOpen(true)
                    }}
                  />
                ))}
              </div> : <div className="empty-results">{t('No books match your selection. Try another search or category.')}</div>
            )}
          </section>
        </>
      )}

      {panelOpen === 'read' && (
        <ReadingLibrary
          entries={readingEntries}
          recommendations={recommendedReadEntries}
          readingRecommendations={readingHistoryRecommendations}
          loading={loadingBooks}
          onRead={openReader}
          onBuy={buyNow}
        />
      )}

      {panelOpen === 'reader' && loadingBooks && (
        <main className="reader-not-found" id="main-content" tabIndex="-1"><p className="reader-status">{t('Loading your reading edition…')}</p></main>
      )}

      {panelOpen === 'reader' && !loadingBooks && activeReaderBook && activeReader && (
        <BookReader
          key={readerBookId}
          book={activeReaderBook}
          reader={activeReader}
          authUser={authUser}
          onBack={returnToReadingLibrary}
          onBuy={buyNow}
        />
      )}

      {panelOpen === 'reader' && !loadingBooks && (!activeReaderBook || !activeReader) && (
        <main className="reader-not-found">
          <h1>{t('This reading edition is not available.')}</h1>
          <button type="button" className="reader-open-button" onClick={returnToReadingLibrary}>{t('Back to the reading room')}</button>
        </main>
      )}

      {panelOpen === 'about' && (
        <AboutSection onClose={() => setPanelOpen('home')} />
      )}

      {panelOpen === 'features' && (
        <section className="features-page">
          <div className="page-title-row">
            <h2>{t('Features')}</h2>
            <span className="page-subtitle">{t('Why readers choose BookStore')}</span>
          </div>
          <Features onOpenAdmin={() => openPanel('admin')} />
        </section>
      )}

      {panelOpen === 'admin' && <AdminDashboard />}

      <Footer onOpenAbout={() => openPanel('about')} />
    </div>
  )
}

export default App
