import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import { showToast } from '../components/Toast.jsx'

const fallbackImage = '/imagenes/obra-placeholder.svg'

function fmtDate(iso) {
  const d = new Date(iso)
  const opt = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  const opt2 = { hour: '2-digit', minute: '2-digit' }
  return `${d.toLocaleDateString('es-SV', opt)} · ${d.toLocaleTimeString('es-SV', opt2)}`
}

function money(cents) {
  return (Number(cents || 0) / 100).toLocaleString('es-SV', { style: 'currency', currency: 'USD' })
}

function clampPositive(value, min = 1) {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.floor(n))
}

export default function FunctionDetail() {
  const { id } = useParams()
  const playId = Number(id)
  const nav = useNavigate()
  const [play, setPlay] = useState(null)
  const [performances, setPerformances] = useState([])
  const [tiers, setTiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [buyingId, setBuyingId] = useState(null)
  const [qtyByPerf, setQtyByPerf] = useState({})
  const [tierByPerf, setTierByPerf] = useState({})

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [{ data: playData, error: playError }, { data: performanceData, error: perfError }] = await Promise.all([
        supabase.from('plays').select('*').eq('id', playId).maybeSingle(),
        supabase.from('performances').select('*').eq('play_id', playId).eq('status', 'ACTIVE').order('starts_at', { ascending: true })
      ])

      if (playError || !playData) {
        showToast('No se encontró la obra solicitada')
        setLoading(false)
        return
      }

      setPlay({ ...playData, image_url: playData.image_url || fallbackImage })
      setPerformances(performanceData || [])

      const performanceIds = (performanceData || []).map((p) => p.id)
      if (performanceIds.length > 0) {
        const { data: tiersData } = await supabase.from('price_tiers').select('*').in('performance_id', performanceIds).order('price_cents', { ascending: true })
        setTiers(tiersData || [])
        const nextTierByPerf = {}
        const nextQtyByPerf = {}
        for (const performance of performanceData || []) {
          nextQtyByPerf[performance.id] = 1
          const firstTier = (tiersData || []).find((tier) => Number(tier.performance_id) === Number(performance.id))
          if (firstTier) nextTierByPerf[performance.id] = firstTier.id
        }
        setTierByPerf(nextTierByPerf)
        setQtyByPerf(nextQtyByPerf)
      } else {
        setTiers([])
      }

      setLoading(false)
    }
    if (Number.isFinite(playId)) load()
  }, [playId])

  const tiersByPerformance = useMemo(() => {
    const map = {}
    for (const tier of tiers) {
      const key = Number(tier.performance_id)
      if (!map[key]) map[key] = []
      map[key].push(tier)
    }
    return map
  }, [tiers])

  const handleQtyChange = (performanceId, value) => {
    setQtyByPerf((prev) => ({ ...prev, [performanceId]: clampPositive(value, 1) }))
  }

  const handleTierChange = (performanceId, value) => {
    setTierByPerf((prev) => ({ ...prev, [performanceId]: Number(value) }))
  }

  const buy = async (performance) => {
    const { data } = await supabase.auth.getSession()
    const sess = data.session
    if (!sess) return nav('/login')

    const selectedTierId = Number(tierByPerf[performance.id])
    const selectedTier = (tiersByPerformance[performance.id] || []).find((tier) => Number(tier.id) === selectedTierId)
    const quantity = clampPositive(qtyByPerf[performance.id] || 1)

    if (!selectedTier) return showToast('Selecciona un precio válido para esta función')
    if (performance.capacity_available < quantity) return showToast('No hay suficientes cupos disponibles para esa cantidad')

    setBuyingId(performance.id)
    const payload = {
      p_performance_id: Number(performance.id),
      p_price_tier_id: Number(selectedTier.id),
      p_quantity: quantity,
      p_coupon_code: null
    }

    const { data: res, error } = await supabase.rpc('buy_tickets', payload)
    setBuyingId(null)

    if (error) {
      const msg = String(error.message || error.details || error.hint || '')
      if (msg.includes('not_authenticated') || msg.toLowerCase().includes('jwt')) {
        try { await supabase.auth.signOut() } catch {}
        showToast('Tu sesión expiró. Vuelve a iniciar sesión para continuar.')
        return nav('/login')
      }
      if (msg.includes('not_enough_capacity')) return showToast('No hay cupos suficientes para completar la compra')
      if (msg.includes('price_tier_not_found')) return showToast('La tarifa seleccionada ya no está disponible')
      if (msg.includes('performance_not_found')) return showToast('La función seleccionada ya no existe o está inactiva')
      if (msg.includes('invalid_quantity')) return showToast('La cantidad debe ser mayor que cero')
      return showToast(msg ? `No se pudo comprar: ${msg}` : 'No se pudo completar la compra')
    }

    try {
      sessionStorage.setItem('last_receipt', JSON.stringify({
        subtotal_cents: res?.subtotal_cents ?? null,
        discount_cents: res?.discount_cents ?? null,
        total_cents: res?.total_cents ?? null,
        coupon_applied: res?.coupon_applied ?? null
      }))
    } catch {}

    showToast(`Compra realizada. Total final: ${money(res?.total_cents || 0)}`)
    nav('/mis-tickets')
  }

  if (loading) return <div className="card shellCard">Cargando la obra...</div>
  if (!play) return <div className="card shellCard">No existe esta obra.</div>

  return (
    <div className="detailPage">
      <section className="detailHero shellCard">
        <div className="detailHeroImageWrap">
          <img className="detailHeroImage" src={play.image_url || fallbackImage} alt={play.title} onError={(e) => { e.currentTarget.src = fallbackImage }} />
        </div>
        <div className="detailHeroContent">
          <p className="eyebrow">Obra #{play.id}</p>
          <h1 className="detailTitle">{play.title}</h1>
          <p className="heroSub">{play.description || 'Sinopsis pendiente.'}</p>
          <div className="row">
            <span className="tag">{play.rating || 'Todo público'}</span>
            <span className="tag">{play.duration_minutes ? `${play.duration_minutes} min` : 'Duración por confirmar'}</span>
            <span className="tag">{performances.length} funciones activas</span>
          </div>
          <div className="space" />
          <div className="card spotlightCard">
            <strong>Imagen de la obra</strong>
            <div className="small">Puedes cambiarla reemplazando el archivo en <code>frontend/public/imagenes</code> y conservando la misma ruta.</div>
          </div>
        </div>
      </section>

      <section className="detailSection">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Funciones disponibles</p>
            <h2 className="sectionTitle">Elige una fecha y completa tu compra</h2>
          </div>
        </div>

        <div className="grid functionsGrid">
          {performances.map((performance) => {
            const tierOptions = tiersByPerformance[performance.id] || []
            const selectedTier = tierOptions.find((tier) => Number(tier.id) === Number(tierByPerf[performance.id])) || tierOptions[0]
            const quantity = clampPositive(qtyByPerf[performance.id] || 1)
            const subtotal = (selectedTier?.price_cents || 0) * quantity

            return (
              <article className="card functionCard shellCard" key={performance.id}>
                <div className="row wrapBetween">
                  <div>
                    <div className="cardTitle">Función #{performance.id}</div>
                    <div className="meta">{fmtDate(performance.starts_at)}</div>
                  </div>
                  <span className="tag">{performance.hall || 'Sala Principal'}</span>
                </div>

                <div className="spaceSm" />
                <div className="row">
                  <span className="tag">Cupo disponible: {performance.capacity_available}</span>
                  <span className="tag">Capacidad total: {performance.capacity_total}</span>
                </div>

                <div className="space" />
                <div className="label">Tipo de entrada</div>
                <select className="input" value={tierByPerf[performance.id] || ''} onChange={(e) => handleTierChange(performance.id, e.target.value)}>
                  {tierOptions.map((tier) => (
                    <option key={tier.id} value={tier.id}>{tier.label} · {money(tier.price_cents)}</option>
                  ))}
                </select>

                <div className="space" />
                <div className="label">Cantidad</div>
                <div className="counterRow">
                  <button className="btn btnCounter" type="button" onClick={() => handleQtyChange(performance.id, quantity - 1)}>-</button>
                  <input
                    className="input inputCounter"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => handleQtyChange(performance.id, e.target.value)}
                  />
                  <button className="btn btnCounter" type="button" onClick={() => handleQtyChange(performance.id, quantity + 1)}>+</button>
                </div>
                <div className="small">Solo se aceptan números enteros mayores que cero.</div>

                <div className="space" />
                <div className="purchaseBox">
                  <div className="small">Total estimado</div>
                  <div className="purchaseTotal">{money(subtotal)}</div>
                </div>

                <div className="space" />
                <button className="btn btnPrimary" onClick={() => buy(performance)} disabled={buyingId === performance.id || !selectedTier}>
                  {buyingId === performance.id ? 'Procesando compra...' : 'Comprar tickets'}
                </button>
              </article>
            )
          })}
          {performances.length === 0 && <div className="card shellCard">Esta obra todavía no tiene funciones activas.</div>}
        </div>
      </section>
    </div>
  )
}
