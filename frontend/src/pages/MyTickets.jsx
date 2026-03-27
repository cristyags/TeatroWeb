import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { showToast } from '../components/Toast.jsx'

function fmtDate(iso) {
  const d = new Date(iso)
  const opt = { year: 'numeric', month: 'short', day: 'numeric' }
  const opt2 = { hour: '2-digit', minute: '2-digit' }
  return `${d.toLocaleDateString('es-SV', opt)} · ${d.toLocaleTimeString('es-SV', opt2)}`
}

function money(cents) {
  return (Number(cents || 0) / 100).toLocaleString('es-SV', { style: 'currency', currency: 'USD' })
}

const fallbackImage = '/imagenes/obra-placeholder.svg'

export default function MyTickets() {
  const [tickets, setTickets] = useState([])
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [receipt, setReceipt] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      try {
        const raw = sessionStorage.getItem('last_receipt')
        if (raw) {
          setReceipt(JSON.parse(raw))
          sessionStorage.removeItem('last_receipt')
        }
      } catch {}

      const { data: ticketsData, error } = await supabase
        .from('tickets')
        .select('id, code, status, used_at, created_at, performance:performances(id, starts_at, hall, play:plays(title, image_url))')
        .order('created_at', { ascending: false })

      if (error) showToast('No se pudieron cargar tus tickets en este momento')
      setTickets(ticketsData || [])

      const { data: emailData } = await supabase
        .from('email_outbox')
        .select('id, subject, body, created_at')
        .order('created_at', { ascending: false })
        .limit(5)

      setEmails(emailData || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="card shellCard">Cargando tus tickets...</div>

  return (
    <div className="grid ticketsGrid">
      <div className="card shellCard">
        <h2 style={{ marginTop: 0 }}>Mis tickets</h2>
        <div className="small">Aquí ves tus entradas activas y las que ya fueron usadas.</div>
        <div className="space" />
        {receipt && typeof receipt.total_cents === 'number' && (
          <div className="card spotlightCard">
            <div style={{ fontWeight: 900 }}>Compra realizada ✅</div>
            <div className="small" style={{ marginTop: 6 }}>
              Total pagado: {money(receipt.total_cents)}
            </div>
          </div>
        )}
        {tickets.length === 0 && <div className="small">Aún no tienes tickets comprados.</div>}
        <div className="stackList">
          {tickets.map((ticket) => (
            <article key={ticket.id} className="miniCard ticketCard">
              <div className="miniCardImageWrap ticketPosterWrap">
                <img className="miniCardImage" src={ticket.performance?.play?.image_url || fallbackImage} alt={ticket.performance?.play?.title || 'Obra'} onError={(e) => { e.currentTarget.src = fallbackImage }} />
              </div>
              <div className="miniCardBody">
                <div className="row wrapBetween">
                  <div>
                    <div className="cardTitle">{ticket.performance?.play?.title || 'Obra sin título'}</div>
                    <div className="meta">{ticket.performance?.starts_at ? fmtDate(ticket.performance.starts_at) : 'Fecha por confirmar'}</div>
                  </div>
                  <span className="tag">{ticket.status}</span>
                </div>
                <div className="spaceSm" />
                <div className="small">Código: <strong>{ticket.code}</strong></div>
                <div className="small">Sala: {ticket.performance?.hall || 'Sala Principal'}</div>
                {ticket.used_at && <div className="small">Usado: {fmtDate(ticket.used_at)}</div>}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="card shellCard">
        <h2 style={{ marginTop: 0 }}>Confirmaciones guardadas</h2>
        <div className="small">Cada compra deja un mensaje con el monto final para que puedas mostrar evidencia de la transacción.</div>
        <div className="space" />
        <div className="stackList compactStack">
          {emails.length === 0 && <div className="small">Todavía no hay confirmaciones guardadas.</div>}
          {emails.map((mail) => (
            <div key={mail.id} className="miniCardBody compactCard">
              <strong>{mail.subject}</strong>
              <div className="small">{fmtDate(mail.created_at)}</div>
              <div className="small">{mail.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
