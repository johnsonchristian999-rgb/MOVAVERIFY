import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  BadgeCheck,
  Bell,
  Check,
  ChevronDown,
  ClipboardList,
  Headphones,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Wallet,
  Zap,
} from 'lucide-react'
import {
  loginSupabaseUser,
  logoutSupabaseUser,
  recoverSupabasePassword,
  registerSupabaseUser,
  subscribeToSupabaseAuth,
} from './services/supabaseAuth.js'
import { supabaseConfigured } from './lib/supabase.js'
import {
  initializeWalletFunding,
  purchaseLiveNumber,
  verifyWalletFunding,
} from './services/backend.js'
import {
  getUserWallet,
  listUserMessages,
  listUserOrders,
  listUserTransactions,
  subscribeToUserTable,
} from './services/supabaseData.js'
import './App.css'

const services = [
  'WhatsApp',
  'Telegram',
  'Google',
  'Facebook',
  'Instagram',
  'TikTok',
  'Microsoft',
  'Other',
]
const countries = [
  { name: 'United States', flag: '🇺🇸', dial: '+1', price: 2500 },
  { name: 'United Kingdom', flag: '🇬🇧', dial: '+44', price: 3200 },
  { name: 'Canada', flag: '🇨🇦', dial: '+1', price: 2900 },
  { name: 'Germany', flag: '🇩🇪', dial: '+49', price: 3500 },
]
const seedOrders = [
  {
    id: 'DEMO-24018',
    service: 'WhatsApp',
    country: 'United States',
    flag: '🇺🇸',
    number: '+1 202 ••• ••48',
    status: 'Waiting for SMS',
    amount: 2500,
    time: 'Today, 10:42 AM',
  },
  {
    id: 'DEMO-24017',
    service: 'Telegram',
    country: 'United Kingdom',
    flag: '🇬🇧',
    number: '+44 7700 •••• 21',
    status: 'Completed',
    amount: 3200,
    time: 'Nov 12, 2026',
  },
  {
    id: 'DEMO-24016',
    service: 'Google',
    country: 'Canada',
    flag: '🇨🇦',
    number: '+1 416 •••• ••19',
    status: 'Expired',
    amount: 2900,
    time: 'Nov 10, 2026',
  },
]

function useDemoStore() {
  const [orders, setOrders] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('numora-demo-orders')) || seedOrders
    } catch {
      return seedOrders
    }
  })
  const [balance, setBalance] = useState(
    () => Number(localStorage.getItem('numora-demo-balance')) || 25000,
  )
  const [transactions, setTransactions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('numora-demo-transactions')) || []
    } catch {
      return []
    }
  })

  function purchaseOrder({ country, service, tier }) {
    const selectedCountry = countries.find((item) => item.name === country)
    const multiplier = { Economy: 0.8, Standard: 1, Premium: 1.4 }[tier]
    const amount = Math.round(selectedCountry.price * multiplier)
    if (balance < amount)
      return {
        error: 'Your demo wallet balance is too low. Add demo funds first.',
      }
    const order = {
      id: `DEMO-${Date.now().toString().slice(-6)}`,
      service,
      country,
      flag: selectedCountry.flag,
      number: 'Number assigned after provider approval',
      status: 'Awaiting provider approval',
      amount,
      time: new Date().toLocaleString(),
    }
    const nextOrders = [order, ...orders]
    const nextBalance = balance - amount
    const transaction = {
      id: order.id,
      description: `${service} verification · ${country}`,
      type: 'debit',
      amount,
      status: 'Demo',
      time: order.time,
    }
    const nextTransactions = [transaction, ...transactions]
    setOrders(nextOrders)
    setBalance(nextBalance)
    setTransactions(nextTransactions)
    localStorage.setItem('numora-demo-orders', JSON.stringify(nextOrders))
    localStorage.setItem('numora-demo-balance', String(nextBalance))
    localStorage.setItem('numora-demo-transactions', JSON.stringify(nextTransactions))
    return { order }
  }

  function addDemoFunds(amount) {
    const nextBalance = balance + amount
    const transaction = {
      id: `FUND-${Date.now()}`,
      description: 'Demo wallet funding',
      type: 'credit',
      amount,
      status: 'Demo only',
      time: new Date().toLocaleString(),
    }
    const nextTransactions = [transaction, ...transactions]
    setBalance(nextBalance)
    setTransactions(nextTransactions)
    localStorage.setItem('numora-demo-balance', String(nextBalance))
    localStorage.setItem('numora-demo-transactions', JSON.stringify(nextTransactions))
  }

  return { orders, balance, transactions, purchaseOrder, addDemoFunds }
}

function AppLayout({ store }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const [user, setUser] = useState(null)
  const [liveOrders, setLiveOrders] = useState([])
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const showToast = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }
  useEffect(() => {
    if (!supabaseConfigured) return undefined
    return subscribeToSupabaseAuth(setUser)
  }, [])
  useEffect(() => {
    if (!user) return undefined
    let active = true
    const refresh = () =>
      listUserOrders()
        .then((orders) => {
          if (active) setLiveOrders(orders)
        })
        .catch((error) => showToast(error.message))
    refresh()
    const stopRealtime = subscribeToUserTable('orders', refresh)
    return () => {
      active = false
      stopRealtime()
    }
  }, [user])
  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref')
    if (!user || !reference) return undefined
    let active = true
    verifyWalletFunding(reference)
      .then((result) => {
        if (active)
          showToast(
            result.credited
              ? 'Payment verified and wallet credited.'
              : 'Payment was already verified.',
          )
      })
      .catch((error) => {
        if (active) showToast(error.message || 'Payment verification failed.')
      })
    return () => {
      active = false
    }
  }, [user, searchParams])
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Mova Verify User'
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const accountOrders = user ? liveOrders : store.orders
  const links = [
    { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/buy', label: 'Buy a Number', icon: ShoppingBag },
    { to: '/orders', label: 'My Orders', icon: ClipboardList },
    { to: '/inbox', label: 'SMS Inbox', icon: MessageSquare, badge: '3' },
    { to: '/wallet', label: 'Wallet', icon: Wallet },
    { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
    { to: '/support', label: 'Support', icon: Headphones },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]
  async function handleLogout() {
    if (!supabaseConfigured) {
      showToast('You are using a guest demo account.')
      return
    }
    try {
      await logoutSupabaseUser()
      showToast('You have been signed out.')
    } catch (error) {
      showToast(error.message)
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <NavLink className="brand" to="/" onClick={() => setMobileOpen(false)}>
          <span
            className="brand-logo"
            role="img"
            aria-label="Mova Verify — Move Value. Move Forward."
          />
        </NavLink>
        <nav className="primary-nav" aria-label="Main navigation">
          {links.map(({ to, label, icon: Icon, badge, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={18} strokeWidth={2} />
              <span>{label}</span>
              {badge && <span className="nav-badge">{badge}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="security-card">
            <span className="security-shield">
              <ShieldCheck size={23} />
            </span>
            <div>
              <strong>
                Your account
                <br />
                is secure
              </strong>
              <small>Demo environment · no live provider connection</small>
            </div>
          </div>
          <button
            className="profile-button"
            type="button"
            onClick={() =>
              user ? showToast(`Signed in as ${displayName}`) : navigate('/auth/login')
            }
          >
            <span className="avatar">{user ? initials : 'MV'}</span>
            <span className="profile-copy">
              <strong>{user ? displayName : 'Guest account'}</strong>
              <small>{user ? user.email : 'Sign in to continue'}</small>
            </span>
            <ChevronDown size={15} />
          </button>
          <button className="logout-button" type="button" onClick={handleLogout}>
            <LogOut size={17} />
            Log Out
          </button>
        </div>
      </aside>
      {mobileOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <main className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={21} />
          </button>
          <label className="global-search">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) =>
                event.key === 'Enter' && navigate(`/orders?q=${encodeURIComponent(search)}`)
              }
              placeholder="Search countries, apps or services..."
              aria-label="Search countries, apps or services"
            />
          </label>
          <div className="topbar-actions">
            <button
              className="notification-button"
              onClick={() => navigate('/inbox')}
              aria-label="Open notifications"
            >
              <Bell size={20} />
              <i>3</i>
            </button>
            <button
              className="top-profile"
              onClick={() => navigate(user ? '/settings' : '/auth/login')}
            >
              <span className="avatar">{user ? initials : 'MV'}</span>
              <strong>{user ? displayName : 'Sign in'}</strong>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>
        <Routes>
          <Route
            path="/"
            element={
              <Overview
                store={store}
                orders={accountOrders}
                displayName={displayName}
                onBuy={() => navigate('/buy')}
                onFunds={() => navigate('/wallet')}
                onToast={showToast}
              />
            }
          />
          <Route path="/buy" element={<BuyPage store={store} user={user} onToast={showToast} />} />
          <Route path="/orders" element={<OrdersPage orders={accountOrders} />} />
          <Route path="/inbox" element={<InboxPage orders={accountOrders} />} />
          <Route
            path="/wallet"
            element={<WalletPage store={store} user={user} onToast={showToast} />}
          />
          <Route path="/transactions" element={<TransactionsPage store={store} />} />
          <Route path="/support" element={<SupportPage onToast={showToast} />} />
          <Route path="/settings" element={<SettingsPage user={user} onToast={showToast} />} />
          <Route path="/auth/:mode" element={<AuthPage onToast={showToast} />} />
          <Route path="/admin/*" element={<AdminPage onToast={showToast} />} />
          <Route
            path="*"
            element={
              <Overview
                store={store}
                orders={accountOrders}
                displayName={displayName}
                onBuy={() => navigate('/buy')}
                onFunds={() => navigate('/wallet')}
                onToast={showToast}
              />
            }
          />
        </Routes>
        <footer className="app-footer">
          <span>
            <b>DEMO MODE</b> · Simulated orders, balance and SMS. No real numbers or payments.
          </span>
          <span>Mova Verify · Help&nbsp; · &nbsp;Privacy</span>
        </footer>
      </main>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

function PageHeader({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="subtitle">{description}</p>}
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  )
}

function WelcomeBanner({ displayName }) {
  return (
    <section className="welcome-banner">
      <div className="welcome-copy">
        <p className="eyebrow">GLOBAL VERIFICATION · DEMO WORKSPACE</p>
        <h1>
          Welcome back, <span>{displayName}</span> <span className="wave">👋</span>
        </h1>
        <p>Manage your verification services in one place.</p>
      </div>
      <div className="globe-art" aria-hidden="true">
        <div className="globe">
          <span>◉</span>
        </div>
        <i className="orbit orbit-one" />
        <i className="orbit orbit-two" />
      </div>
    </section>
  )
}

function MetricCard({ icon: Icon, title, value, note, tone }) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-icon">
        <Icon size={21} />
      </div>
      <div className="metric-copy">
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
      <svg className="metric-spark" viewBox="0 0 76 42" aria-hidden="true">
        <path d="M2 36 L17 27 L29 31 L42 17 L53 22 L72 4" />
      </svg>
    </article>
  )
}

function QuickPurchase({ onPurchase }) {
  const [country, setCountry] = useState(countries[0].name)
  const [service, setService] = useState(services[0])
  const [tier, setTier] = useState('Standard')
  return (
    <section className="quick-purchase panel">
      <div className="quick-head">
        <div>
          <h2>
            <Zap size={19} fill="currentColor" /> Quick Purchase
          </h2>
          <p>Choose a country and service to view demo availability.</p>
        </div>
        <div className="coverage-badge">
          <span className="coverage-icon">◎</span>
          <div>
            <strong>Global coverage</strong>
            <small>Supported regions shown in demo mode</small>
          </div>
        </div>
      </div>
      <form
        className="purchase-form"
        onSubmit={(event) => {
          event.preventDefault()
          onPurchase({ country, service, tier })
        }}
      >
        <label className="field-label">
          Select Country
          <select value={country} onChange={(event) => setCountry(event.target.value)}>
            {countries.map((item) => (
              <option key={item.name} value={item.name}>
                {item.flag}　{item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Select Service
          <select value={service} onChange={(event) => setService(event.target.value)}>
            {services.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="field-label tier-field">
          Price tier
          <select value={tier} onChange={(event) => setTier(event.target.value)}>
            <option>Economy</option>
            <option>Standard</option>
            <option>Premium</option>
          </select>
        </label>
        <button className="button button-primary" type="submit">
          Find demo options <ArrowRight size={16} />
        </button>
      </form>
    </section>
  )
}

function RecentOrders({ orders, onViewAll }) {
  return (
    <section className="panel orders-panel">
      <div className="panel-header">
        <div>
          <h2>Recent Orders</h2>
          <p>Latest activity from this demo account</p>
        </div>
        <button className="text-action" onClick={onViewAll}>
          View All <ArrowRight size={15} />
        </button>
      </div>
      <div className="orders-list">
        {orders.slice(0, 3).map((order) => (
          <div className="order-row" key={order.id}>
            <span className="flag">{order.flag}</span>
            <div className="order-service">
              <strong>{order.service}</strong>
              <small>{order.number}</small>
            </div>
            <span className={`status-pill ${order.status.toLowerCase().replaceAll(' ', '-')}`}>
              {order.status}
            </span>
            <div className="order-amount">
              <strong>₦{order.amount.toLocaleString()}</strong>
              <small>{order.time}</small>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Overview({ store, orders, displayName, onBuy, onFunds, onToast }) {
  const navigate = useNavigate()
  function createOrder(selection) {
    const result = store.purchaseOrder(selection)
    if (result.error) onToast(result.error)
    else onToast('Demo order created. No number has been requested from a provider.')
  }
  return (
    <div className="view-root">
      <WelcomeBanner displayName={displayName} />
      <section className="metric-grid">
        <article className="balance-card">
          <div>
            <span className="balance-label">
              <Wallet size={16} /> Your Wallet Balance <span className="demo-chip">DEMO</span>
            </span>
            <strong>₦{store.balance.toLocaleString('en-NG')}.00</strong>
            <small>
              <span className="growth-up">
                <ArrowDownLeft size={13} /> Demo balance
              </span>{' '}
              · Not real funds
            </small>
          </div>
          <button className="button button-bright" onClick={onFunds}>
            Add Demo Funds <Plus size={16} />
          </button>
        </article>
        <MetricCard
          icon={ShoppingBag}
          title="Total Orders"
          value={String(orders.length)}
          note={orders.length ? 'Account activity' : 'No orders yet'}
          tone="blue"
        />
        <MetricCard
          icon={BadgeCheck}
          title="Successful"
          value={String(orders.filter((order) => order.status === 'Completed').length)}
          note="Completed orders"
          tone="green"
        />
        <MetricCard
          icon={Headphones}
          title="Support Tickets"
          value="5"
          note="Demo metric"
          tone="purple"
        />
      </section>
      <QuickPurchase onPurchase={createOrder} />
      <div className="content-grid">
        <RecentOrders orders={orders} onViewAll={() => navigate('/orders')} />
        <section className="promo-panel">
          <div>
            <span className="promo-kicker">A note about demo mode</span>
            <h2>
              Try the workflow.
              <br />
              No live numbers yet.
            </h2>
            <p>
              Purchases, wallet funds and inbox activity are simulated until approved provider
              credentials are configured.
            </p>
            <button className="button button-white" onClick={onBuy}>
              Explore services <ArrowRight size={15} />
            </button>
          </div>
          <div className="promo-phone" aria-hidden="true">
            <div className="phone-screen">
              <ShieldCheck size={34} />
              <span>DEMO</span>
            </div>
          </div>
        </section>
      </div>
      <section className="chart-panel panel">
        <div className="panel-header">
          <div>
            <h2>Usage overview</h2>
            <p>Illustrative demo activity · not provider data</p>
          </div>
          <span className="period-badge">
            Last 7 days <ChevronDown size={14} />
          </span>
        </div>
        <div className="chart-area">
          <div className="chart-y">
            <span>30</span>
            <span>20</span>
            <span>10</span>
            <span>0</span>
          </div>
          <div className="chart-lines">
            <i />
            <i />
            <i />
            <i />
            <svg
              viewBox="0 0 800 160"
              preserveAspectRatio="none"
              aria-label="Illustrative demo usage chart"
            >
              <path
                className="chart-fill"
                d="M0 130 C70 120 75 78 145 92 S220 115 285 74 S360 99 425 50 S500 83 565 61 S640 91 700 31 S760 53 800 16 L800 160 L0 160Z"
              />
              <path
                className="chart-path"
                d="M0 130 C70 120 75 78 145 92 S220 115 285 74 S360 99 425 50 S500 83 565 61 S640 91 700 31 S760 53 800 16"
              />
            </svg>
            <div className="chart-x">
              <span>Nov 7</span>
              <span>Nov 8</span>
              <span>Nov 9</span>
              <span>Nov 10</span>
              <span>Nov 11</span>
              <span>Nov 12</span>
              <span>Nov 13</span>
            </div>
          </div>
        </div>
      </section>
      {store.transactions.length > 0 && (
        <section className="demo-note">
          <Check size={16} />
          <span>
            Demo activity is stored only in this browser and is clearly marked as simulated.
          </span>
        </section>
      )}
    </div>
  )
}

function BuyPage({ store, user, onToast }) {
  async function createOrder(selection) {
    if (user) {
      const countryCodes = {
        'United States': 'US',
        'United Kingdom': 'GB',
        Canada: 'CA',
        Germany: 'DE',
      }
      try {
        const result = await purchaseLiveNumber({
          countryCode: countryCodes[selection.country],
          service: selection.service,
          tier: selection.tier,
        })
        onToast(`Live order ${result.orderId} created and is waiting for SMS.`)
      } catch (error) {
        onToast(error.message || 'Live purchase could not be completed.')
      }
      return
    }
    const result = store.purchaseOrder(selection)
    if (result.error) onToast(result.error)
    else onToast('Demo order created without contacting Twilio or another provider.')
  }
  return (
    <div className="view-root">
      <PageHeader
        eyebrow="Verification services"
        title="Buy a Number"
        description="Explore simulated availability. Live purchases are disabled until provider approval and server configuration."
      />
      <div className="notice-banner">
        <ShieldCheck size={18} />
        <span>
          <strong>Demo mode is on.</strong> The options below are examples only and are not actual
          inventory.
        </span>
      </div>
      <QuickPurchase onPurchase={createOrder} />
      <div className="service-grid">
        {services.map((service, index) => (
          <article className="service-card" key={service}>
            <span className={`service-monogram color-${index}`}>{service.slice(0, 1)}</span>
            <div>
              <strong>{service}</strong>
              <small>Verification service</small>
            </div>
            <span className="availability-tag">Demo</span>
          </article>
        ))}
      </div>
    </div>
  )
}

function OrdersPage({ orders }) {
  const [filter, setFilter] = useState('All orders')
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const normalizedQuery = query.trim().toLowerCase()
  const filtered = orders.filter((order) => {
    const matchesFilter = filter === 'All orders' || order.status === filter
    const searchable = `${order.service} ${order.country} ${order.number} ${order.id}`.toLowerCase()
    return matchesFilter && (!normalizedQuery || searchable.includes(normalizedQuery))
  })
  return (
    <div className="view-root">
      <PageHeader
        eyebrow="Account activity"
        title="My Orders"
        description="Review your demo verification requests and order statuses."
      >
        <select
          className="select-control"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option>All orders</option>
          <option>Completed</option>
          <option>Waiting for SMS</option>
          <option>Expired</option>
        </select>
      </PageHeader>
      <div className="panel table-panel">
        <div className="table-intro">
          <strong>{filtered.length} orders</strong>
          <span>Demo data · no provider connections</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Country / number</th>
                <th>Order ID</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Placed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id}>
                  <td>
                    <b>{order.service}</b>
                  </td>
                  <td>
                    <span className="flag">{order.flag}</span> {order.number}
                  </td>
                  <td>{order.id}</td>
                  <td>
                    <span
                      className={`status-pill ${order.status.toLowerCase().replaceAll(' ', '-')}`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td>₦{order.amount.toLocaleString()}</td>
                  <td>{order.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function InboxPage({ orders }) {
  const [user, setUser] = useState(null)
  const [liveMessages, setLiveMessages] = useState([])
  const [liveError, setLiveError] = useState('')
  useEffect(() => {
    if (!supabaseConfigured) return undefined
    return subscribeToSupabaseAuth(setUser)
  }, [])
  useEffect(() => {
    if (!user) return undefined
    let active = true
    const refresh = () =>
      listUserMessages()
        .then((messages) => {
          if (active) setLiveMessages(messages)
        })
        .catch((error) => {
          if (active) setLiveError(error.message)
        })
    refresh()
    const stopRealtime = subscribeToUserTable('messages', refresh)
    return () => {
      active = false
      stopRealtime()
    }
  }, [user])
  const demoMessages = orders
    .filter((order) => order.status === 'Completed')
    .map((order) => ({
      ...order,
      code: 'SIMULATED · 000000',
      body: `Simulated ${order.service} verification message. No SMS was received.`,
      receivedAt: order.time,
      demo: true,
    }))
  const messages = user ? liveMessages : demoMessages
  return (
    <div className="view-root">
      <PageHeader
        eyebrow="Messages"
        title="SMS Inbox"
        description={
          user
            ? 'Live messages from your authenticated Firestore account.'
            : 'Messages are simulated in this demo. Live inbox requires sign-in and provider configuration.'
        }
      />
      <div className="notice-banner">
        <MessageSquare size={18} />
        <span>
          {liveError ||
            (user
              ? 'Live messages are scoped to your account. No demo messages are mixed into this inbox.'
              : 'This inbox contains simulated demo content only. No SMS was received.')}
        </span>
      </div>
      <section className="panel inbox-list">
        {messages.length ? (
          messages.map((message) => (
            <article className="message-row" key={message.id}>
              <span className="flag">{message.flag || '✉'}</span>
              <div className="message-copy">
                <strong>
                  {message.service || 'Verification'}{' '}
                  <span className="demo-chip">{message.demo ? 'SIMULATED' : 'LIVE'}</span>
                </strong>
                <p>{message.demo ? message.body : message.body}</p>
                <small>
                  {message.receivedAt?.toDate
                    ? message.receivedAt.toDate().toLocaleString()
                    : message.receivedAt}{' '}
                  · Order {message.orderId || message.id}
                </small>
              </div>
              <strong className="message-code">{message.demo ? message.code : 'Received'}</strong>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <MessageSquare size={25} />
            <strong>{user ? 'No messages received' : 'No demo messages yet'}</strong>
            <p>
              {user
                ? 'Signed-in live messages will appear here after provider delivery.'
                : 'Completed demo orders appear here as clearly simulated messages.'}
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

function WalletPage({ store, user, onToast }) {
  const [amount, setAmount] = useState('5000')
  const [liveWallet, setLiveWallet] = useState(null)
  const [liveTransactions, setLiveTransactions] = useState([])
  useEffect(() => {
    if (!user) return undefined
    let active = true
    const refresh = () =>
      Promise.all([getUserWallet(), listUserTransactions()])
        .then(([wallet, transactions]) => {
          if (active) {
            setLiveWallet({ balanceNaira: wallet.balance_naira })
            setLiveTransactions(transactions)
          }
        })
        .catch((error) => {
          if (active) onToast(error.message)
        })
    refresh()
    const stopWalletRealtime = subscribeToUserTable('wallets', refresh)
    const stopTransactionRealtime = subscribeToUserTable('transactions', refresh)
    return () => {
      active = false
      stopWalletRealtime()
      stopTransactionRealtime()
    }
  }, [user, onToast])
  const [busy, setBusy] = useState(false)
  async function fundWallet(event) {
    event.preventDefault()
    const value = Number(amount)
    if (!Number.isSafeInteger(value) || value < 500)
      return onToast('Enter a whole-Naira amount of at least ₦500.')
    if (!user) {
      store.addDemoFunds(value)
      onToast(`₦${value.toLocaleString()} demo funds added. No payment occurred.`)
      return
    }
    setBusy(true)
    try {
      const { authorizationUrl } = await initializeWalletFunding(value)
      window.location.assign(authorizationUrl)
    } catch (error) {
      onToast(error.message || 'Paystack checkout could not be started.')
    } finally {
      setBusy(false)
    }
  }
  const balance = user ? liveWallet?.balanceNaira || 0 : store.balance
  const transactions = user
    ? liveTransactions.map((item) => ({
        ...item,
        amount: item.amountNaira || 0,
        description: item.reference || item.id,
        status: item.status || 'Live',
        time: item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : 'Processing',
      }))
    : store.transactions
  return (
    <div className="view-root">
      <PageHeader
        eyebrow="Wallet"
        title="Your Wallet"
        description={
          user
            ? 'Fund your wallet through verified Paystack checkout.'
            : 'Manage demo funds. Paystack is not connected and no payments are being processed.'
        }
      />
      <div className="wallet-layout">
        <section className="wallet-balance-card">
          <Wallet size={21} />
          <span>{user ? 'Available wallet balance' : 'Available demo balance'}</span>
          <strong>₦{balance.toLocaleString('en-NG')}.00</strong>
          <small>{user ? 'SERVER-VERIFIED BALANCE' : 'SIMULATED BALANCE · NOT REAL MONEY'}</small>
        </section>
        <section className="panel funding-panel">
          <h2>{user ? 'Fund with Paystack' : 'Add Demo Funds'}</h2>
          <p>
            {user
              ? 'Checkout is verified by the backend before your wallet is credited.'
              : 'Test the wallet flow without making a payment.'}
          </p>
          <form onSubmit={fundWallet}>
            <label className="field-label">
              Amount in Naira
              <input
                type="number"
                min="500"
                step="500"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </label>
            <div className="quick-amounts">
              {['5000', '10000', '25000'].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={amount === value ? 'chosen' : ''}
                  onClick={() => setAmount(value)}
                >
                  ₦{Number(value).toLocaleString()}
                </button>
              ))}
            </div>
            <button className="button button-primary" type="submit" disabled={busy}>
              {busy ? 'Opening checkout…' : user ? 'Continue to Paystack' : 'Add demo funds'}{' '}
              <Plus size={16} />
            </button>
            <small className="form-disclaimer">
              {user
                ? 'Your wallet is credited only after server-side Paystack verification.'
                : 'Paystack checkout becomes available after Firebase and backend configuration.'}
            </small>
          </form>
        </section>
      </div>
      <TransactionsTable transactions={transactions} />
    </div>
  )
}

function TransactionsTable({ transactions }) {
  return (
    <section className="panel table-panel transaction-history">
      <div className="panel-header">
        <div>
          <h2>Wallet Activity</h2>
          <p>Demo ledger entries saved in this browser</p>
        </div>
      </div>
      {transactions.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((item) => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td>{item.id}</td>
                  <td>
                    <span className="status-pill demo-status">{item.status}</span>
                  </td>
                  <td className={item.type === 'credit' ? 'positive-amount' : ''}>
                    {item.type === 'credit' ? '+' : '−'}₦{item.amount.toLocaleString()}
                  </td>
                  <td>{item.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">No wallet transactions in this demo session.</div>
      )}
    </section>
  )
}

function TransactionsPage({ store }) {
  return (
    <div className="view-root">
      <PageHeader
        eyebrow="Account activity"
        title="Transactions"
        description="See demo wallet credits and order debits. No real payments are included."
      />
      <TransactionsTable transactions={store.transactions} />
    </div>
  )
}

function SupportPage({ onToast }) {
  const [submitted, setSubmitted] = useState(false)
  return (
    <div className="view-root">
      <PageHeader
        eyebrow="Help center"
        title="Customer Support"
        description="Create a demo support ticket or browse common questions."
      />
      <div className="support-layout">
        <form
          className="panel support-form"
          onSubmit={(event) => {
            event.preventDefault()
            setSubmitted(true)
            onToast('Demo ticket created. It was not sent to a support team.')
          }}
        >
          <h2>Submit a support ticket</h2>
          <p>Tickets are saved for this demo session only.</p>
          <label className="field-label">
            Topic
            <select>
              <option>Order assistance</option>
              <option>Wallet and payments</option>
              <option>Account access</option>
              <option>Other</option>
            </select>
          </label>
          <label className="field-label">
            Subject
            <input required placeholder="What do you need help with?" />
          </label>
          <label className="field-label">
            Details
            <textarea required rows="4" placeholder="Describe the issue..." />
          </label>
          <button className="button button-primary" type="submit">
            {submitted ? 'Create another ticket' : 'Create demo ticket'} <ArrowRight size={15} />
          </button>
        </form>
        <section className="panel faq-panel">
          <h2>Common questions</h2>
          {[
            'When will my number be available?',
            'How are demo wallet funds handled?',
            'Can I receive a real verification SMS?',
          ].map((question) => (
            <details key={question}>
              <summary>
                {question}
                <Plus size={15} />
              </summary>
              <p>
                This workspace is in demo mode. No live inventory, payments, or SMS are available
                until backend configuration and provider approval are complete.
              </p>
            </details>
          ))}
        </section>
      </div>
    </div>
  )
}

function SettingsPage({ user, onToast }) {
  const fallbackName = 'Johnson Christian'
  const name = user?.displayName || fallbackName
  const email = user?.email || 'johnson@example.com'
  return (
    <div className="view-root">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage profile and security preferences for your Numora account."
      />
      <div className="settings-layout">
        <section className="panel settings-panel">
          <h2>Profile information</h2>
          <p>
            {user
              ? 'Profile details from your Firebase account.'
              : 'Demo profile details. Firebase Authentication is not configured.'}
          </p>
          <div className="settings-fields">
            <label className="field-label">
              Full name
              <input defaultValue={name} />
            </label>
            <label className="field-label">
              Email address
              <input type="email" defaultValue={email} readOnly={Boolean(user)} />
            </label>
            <label className="field-label">
              Preferred currency
              <select defaultValue="NGN">
                <option value="NGN">Nigerian Naira (NGN)</option>
              </select>
            </label>
            <button
              className="button button-primary"
              onClick={() =>
                onToast(
                  user
                    ? 'Profile editing will be enabled after the profile update function is configured.'
                    : 'Profile changes are local demo interactions only.',
                )
              }
            >
              Save changes
            </button>
          </div>
        </section>
        <section className="panel settings-panel">
          <h2>Security</h2>
          <div className="security-setting">
            <LockKeyhole size={19} />
            <div>
              <strong>Password and sign-in</strong>
              <small>Supabase Auth manages live account security.</small>
            </div>
            <button
              className="button button-secondary"
              onClick={() => onToast('Password management is handled by Supabase Auth.')}
            >
              Manage
            </button>
          </div>
          <div className="security-setting">
            <ShieldCheck size={19} />
            <div>
              <strong>Administrator access</strong>
              <small>Role claims must be assigned from a trusted backend.</small>
            </div>
            <button
              className="button button-secondary"
              onClick={() => onToast('Admin permissions are server-controlled.')}
            >
              Protected
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

function AdminPage({ onToast }) {
  const tabs = ['Overview', 'Countries', 'Services & pricing', 'Users', 'Orders', 'Providers']
  return (
    <div className="view-root">
      <PageHeader
        eyebrow="Restricted area"
        title="Admin Console"
        description="Secure admin permissions and Firestore-backed management are not configured in this demo."
      />
      <div className="notice-banner">
        <ShieldCheck size={18} />
        <span>
          Administrator access is disabled. A server-verified Firebase custom claim is required
          before managing platform data.
        </span>
      </div>
      <div className="admin-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() =>
              onToast(
                'Admin data management is disabled until Firebase Functions and role claims are configured.',
              )
            }
          >
            {tab}
          </button>
        ))}
      </div>
      <section className="panel admin-lock">
        <LockKeyhole size={29} />
        <h2>Admin workspace locked</h2>
        <p>
          Provider secrets, service pricing and user management must only be available to verified
          administrators through secure server functions.
        </p>
        <button
          className="button button-secondary"
          onClick={() =>
            onToast('Contact the project owner to provision a verified admin account.')
          }
        >
          Request admin access
        </button>
      </section>
    </div>
  )
}

function AuthPage({ onToast }) {
  const { mode: requestedMode } = useParams()
  const mode = ['login', 'register', 'recover'].includes(requestedMode) ? requestedMode : 'login'
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      if (mode === 'register')
        await registerSupabaseUser({
          name: form.get('name'),
          email: form.get('email'),
          password: form.get('password'),
        })
      if (mode === 'login')
        await loginSupabaseUser({
          email: form.get('email'),
          password: form.get('password'),
        })
      if (mode === 'recover') await recoverSupabasePassword(form.get('email'))
      onToast(mode === 'recover' ? 'Password recovery email sent.' : 'You are signed in.')
      if (mode !== 'recover') navigate('/')
    } catch (authError) {
      setError(authError.message || 'Authentication could not be completed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="view-root auth-view">
      <section className="panel auth-panel">
        <div className="auth-brand">
          <span className="brand-mark">
            <span>✦</span>
          </span>
          <strong>NUMORA</strong>
        </div>
        <p className="eyebrow">GLOBAL VERIFICATION</p>
        <h1>
          {mode === 'register'
            ? 'Create your account'
            : mode === 'recover'
              ? 'Reset your password'
              : 'Welcome back'}
        </h1>
        <p className="subtitle">
          {supabaseConfigured
            ? 'Use your Numora account to continue.'
            : 'Supabase Auth is not configured. Demo mode remains available.'}
        </p>
        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}
        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && (
            <label className="field-label">
              Full name
              <input name="name" autoComplete="name" required />
            </label>
          )}
          <label className="field-label">
            Email address
            <input name="email" type="email" autoComplete="email" required />
          </label>
          {mode !== 'recover' && (
            <label className="field-label">
              Password
              <input
                name="password"
                type="password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                minLength={mode === 'register' ? 10 : undefined}
                required
              />
            </label>
          )}
          <button
            className="button button-primary"
            type="submit"
            disabled={busy || !supabaseConfigured}
          >
            {busy
              ? 'Please wait…'
              : mode === 'register'
                ? 'Create account'
                : mode === 'recover'
                  ? 'Send recovery email'
                  : 'Sign in'}{' '}
            <ArrowRight size={15} />
          </button>
        </form>
        {!supabaseConfigured && (
          <button
            className="button button-secondary auth-demo-button"
            onClick={() => {
              onToast('Continuing in clearly labeled demo mode.')
              navigate('/')
            }}
          >
            Continue in demo mode
          </button>
        )}
        <div className="auth-links">
          {mode !== 'login' && <Link to="/auth/login">Sign in</Link>}
          {mode !== 'register' && <Link to="/auth/register">Create account</Link>}
          {mode !== 'recover' && <Link to="/auth/recover">Forgot password?</Link>}
        </div>
        <Link className="back-link" to="/">
          Back to demo dashboard
        </Link>
      </section>
    </div>
  )
}

function App() {
  const store = useDemoStore()
  return (
    <BrowserRouter>
      <AppLayout store={store} />
    </BrowserRouter>
  )
}

export default App
