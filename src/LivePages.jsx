import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { purchaseLiveNumber } from './services/backend.js'
import {
  createSupportTicket,
  getUserProfile,
  getUserWallet,
  getAdminDashboard,
  listCatalog,
  listUserSupportTickets,
  listUserTransactions,
  updateUserProfile,
  updateCatalogEntry,
  updateSupportTicketStatus,
} from './services/supabaseData.js'

function useLoad(loader) {
  const [state, setState] = useState({ data: null, error: '' })
  useEffect(() => {
    let active = true
    loader().then(
      (data) => active && setState({ data, error: '' }),
      (error) => active && setState({ data: null, error: error.message }),
    )
    return () => {
      active = false
    }
  }, [loader])
  return state
}

const names = { US: 'United States', GB: 'United Kingdom', CA: 'Canada', DE: 'Germany' }

export function LiveOverview({ orders, displayName }) {
  const { data: wallet, error } = useLoad(getUserWallet)
  return (
    <div className="view-root">
      <section className="welcome-banner">
        <div className="welcome-copy">
          <p className="eyebrow">MOVA VERIFY</p>
          <h1>
            Welcome back, <span>{displayName}</span>
          </h1>
          <p>Manage your account and verification orders.</p>
        </div>
      </section>
      {error && <p role="alert">{error}</p>}
      <section className="metric-grid">
        <article className="balance-card">
          <div>
            <span className="balance-label">Wallet balance</span>
            <strong>
              {wallet ? `₦${wallet.balance_naira.toLocaleString('en-NG')}` : 'Loading…'}
            </strong>
          </div>
          <Link className="button button-bright" to="/wallet">
            Fund wallet
          </Link>
        </article>
        <article className="metric-card blue">
          <div className="metric-copy">
            <span>Total orders</span>
            <strong>{orders.length}</strong>
          </div>
        </article>
      </section>
      <section className="panel orders-panel">
        <div className="panel-header">
          <h2>Recent orders</h2>
          <Link to="/orders">View all</Link>
        </div>
        {orders.length ? (
          orders.slice(0, 3).map((order) => (
            <div className="order-row" key={order.id}>
              <strong>{order.service}</strong>
              <span>{order.number}</span>
              <span>{order.status.replaceAll('_', ' ')}</span>
            </div>
          ))
        ) : (
          <div className="empty-state">You have no orders yet.</div>
        )}
        <Link className="button button-primary" to="/buy">
          View available numbers
        </Link>
      </section>
    </div>
  )
}

export function LiveBuy() {
  const { data: catalog, error } = useLoad(listCatalog)
  const [country, setCountry] = useState('')
  const [service, setService] = useState('')
  const [tier, setTier] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const item = catalog?.find((entry) => entry.country_code === country)
  const tiers = Object.entries(item?.pricing?.[service] || {})
  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const result = await purchaseLiveNumber({ countryCode: country, service, tier })
      setMessage(`Order ${result.orderId} created.`)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="view-root">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Verification services</p>
          <h1>Buy a Number</h1>
          <p className="subtitle">Choose from available services and prices.</p>
        </div>
      </div>
      <section className="panel support-form">
        {error ? (
          <p role="alert">{error}</p>
        ) : !catalog ? (
          <p>Loading availability…</p>
        ) : !catalog.length ? (
          <p>No numbers are currently available. Please check back later.</p>
        ) : (
          <form onSubmit={submit}>
            <label className="field-label">
              Country
              <select
                required
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value)
                  setService('')
                  setTier('')
                }}
              >
                <option value="">Select country</option>
                {catalog.map((entry) => (
                  <option key={entry.country_code} value={entry.country_code}>
                    {names[entry.country_code] || entry.country_code}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Service
              <select
                required
                value={service}
                onChange={(e) => {
                  setService(e.target.value)
                  setTier('')
                }}
              >
                <option value="">Select service</option>
                {(item?.services || [])
                  .filter((s) => Object.keys(item.pricing?.[s] || {}).length)
                  .map((s) => (
                    <option key={s}>{s}</option>
                  ))}
              </select>
            </label>
            <label className="field-label">
              Price
              <select required value={tier} onChange={(e) => setTier(e.target.value)}>
                <option value="">Select price</option>
                {tiers.map(([name, price]) => (
                  <option key={name} value={name}>
                    {name} — ₦{price.toLocaleString('en-NG')}
                  </option>
                ))}
              </select>
            </label>
            <button className="button button-primary" disabled={busy}>
              {busy ? 'Processing…' : 'Buy number'}
            </button>
          </form>
        )}
        {message && <p role="status">{message}</p>}
      </section>
    </div>
  )
}

export function LiveTransactions() {
  const { data, error } = useLoad(listUserTransactions)
  return (
    <div className="view-root">
      <h1>Transactions</h1>
      <section className="panel support-form">
        {error ? (
          <p role="alert">{error}</p>
        ) : !data ? (
          <p>Loading…</p>
        ) : data.length ? (
          data.map((item) => (
            <div className="order-row" key={item.id}>
              <span>{item.type}</span>
              <strong>₦{item.amount.toLocaleString('en-NG')}</strong>
              <span>{item.status}</span>
              <span>{item.time}</span>
            </div>
          ))
        ) : (
          <p>No transactions yet.</p>
        )}
      </section>
    </div>
  )
}

export function LiveSupport() {
  const { data, error } = useLoad(listUserSupportTickets)
  const [tickets, setTickets] = useState([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    setBusy(true)
    setMessage('')
    try {
      const ticket = await createSupportTicket({
        topic: values.get('topic'),
        subject: values.get('subject'),
        details: values.get('details'),
      })
      setTickets((previous) => [ticket, ...previous])
      form.reset()
      setMessage('Ticket saved. Your support team can review it.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="view-root">
      <h1>Customer Support</h1>
      <div className="support-layout">
        <form className="panel support-form" onSubmit={submit}>
          <h2>Submit a ticket</h2>
          <label className="field-label">
            Topic
            <select name="topic">
              <option>Order assistance</option>
              <option>Wallet and payments</option>
              <option>Account access</option>
              <option>Other</option>
            </select>
          </label>
          <label className="field-label">
            Subject
            <input name="subject" required minLength={3} maxLength={160} />
          </label>
          <label className="field-label">
            Details
            <textarea name="details" required minLength={10} maxLength={5000} />
          </label>
          <button className="button button-primary" disabled={busy}>
            Submit ticket
          </button>
          {message && <p role="status">{message}</p>}
        </form>
        <section className="panel support-form">
          <h2>Your tickets</h2>
          {error ? (
            <p role="alert">{error}</p>
          ) : !data ? (
            <p>Loading…</p>
          ) : [...tickets, ...data].length ? (
            [...tickets, ...data].map((t) => (
              <div className="order-row" key={t.id}>
                <strong>{t.subject}</strong>
                <span>{t.status}</span>
              </div>
            ))
          ) : (
            <p>No tickets yet.</p>
          )}
        </section>
      </div>
    </div>
  )
}

export function LiveSettings({ user }) {
  const { data, error } = useLoad(getUserProfile)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    const name = new FormData(event.currentTarget).get('name')
    setBusy(true)
    setMessage('')
    try {
      await updateUserProfile({ displayName: name })
      setMessage('Profile saved.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="view-root">
      <h1>Settings</h1>
      <section className="panel settings-panel">
        <h2>Profile information</h2>
        {error ? (
          <p role="alert">{error}</p>
        ) : !data ? (
          <p>Loading profile…</p>
        ) : (
          <form className="settings-fields" onSubmit={submit}>
            <label className="field-label">
              Full name
              <input name="name" defaultValue={data.display_name} required maxLength={100} />
            </label>
            <label className="field-label">
              Email
              <input value={user.email || ''} readOnly />
            </label>
            <button className="button button-primary" disabled={busy}>
              Save changes
            </button>
          </form>
        )}
        {message && <p role="status">{message}</p>}
      </section>
    </div>
  )
}

export function LiveAdmin() {
  const { data, error } = useLoad(getAdminDashboard)
  const [message, setMessage] = useState('')
  const [catalog, setCatalog] = useState(null)
  const [tickets, setTickets] = useState(null)
  const catalogRows = catalog || data?.catalog || []
  const ticketRows = tickets || data?.tickets || []
  async function toggleCatalog(entry) {
    setMessage('')
    try {
      const updated = await updateCatalogEntry(entry.country_code, { active: !entry.active })
      setCatalog(
        catalogRows.map((row) => (row.country_code === updated.country_code ? updated : row)),
      )
      setMessage(`${updated.country_code} is now ${updated.active ? 'active' : 'inactive'}.`)
    } catch (err) {
      setMessage(err.message)
    }
  }
  async function changeTicket(ticket, status) {
    setMessage('')
    try {
      const updated = await updateSupportTicketStatus(ticket.id, status)
      setTickets(ticketRows.map((row) => (row.id === updated.id ? updated : row)))
      setMessage('Ticket status updated.')
    } catch (err) {
      setMessage(err.message)
    }
  }
  if (error)
    return (
      <div className="view-root">
        <h1>Admin Console</h1>
        <div className="notice-banner" role="alert">
          {error}
        </div>
      </div>
    )
  if (!data)
    return (
      <div className="view-root">
        <p>Loading administrator workspace…</p>
      </div>
    )
  return (
    <div className="view-root">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Restricted area</p>
          <h1>Admin Console</h1>
          <p className="subtitle">Manage catalog availability and customer support.</p>
        </div>
      </div>
      {message && (
        <div className="notice-banner" role="status">
          {message}
        </div>
      )}
      <section className="metric-grid">
        <article className="metric-card blue">
          <div className="metric-copy">
            <span>Users</span>
            <strong>{data.profiles.length}</strong>
          </div>
        </article>
        <article className="metric-card green">
          <div className="metric-copy">
            <span>Orders</span>
            <strong>{data.orders.length}</strong>
          </div>
        </article>
        <article className="metric-card purple">
          <div className="metric-copy">
            <span>Support tickets</span>
            <strong>{ticketRows.length}</strong>
          </div>
        </article>
      </section>
      <section className="panel support-form">
        <h2>Catalog countries</h2>
        {catalogRows.map((entry) => (
          <div className="order-row" key={entry.country_code}>
            <strong>{names[entry.country_code] || entry.country_code}</strong>
            <span>{entry.active ? 'Active' : 'Inactive'}</span>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => toggleCatalog(entry)}
            >
              {entry.active ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </section>
      <section className="panel support-form">
        <h2>Support tickets</h2>
        {ticketRows.length ? (
          ticketRows.map((ticket) => (
            <div className="order-row" key={ticket.id}>
              <strong>{ticket.subject}</strong>
              <span>{ticket.status}</span>
              <select
                value={ticket.status}
                onChange={(event) => changeTicket(ticket, event.target.value)}
              >
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          ))
        ) : (
          <p>No support tickets.</p>
        )}
      </section>
    </div>
  )
}
