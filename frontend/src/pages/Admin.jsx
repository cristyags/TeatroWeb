import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { showToast } from '../components/Toast.jsx'

const placeholderImage = '/imagenes/obra-placeholder.svg'
const PLAY_IMAGES_BUCKET = 'play-images'
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const TARGET_IMAGE_WIDTH = 1600
const TARGET_IMAGE_HEIGHT = 900

function fmtDateInput(dt) {
  const d = new Date(dt)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtDate(dt) {
  return new Date(dt).toLocaleString('es-SV')
}

function money(cents) {
  return (Number(cents || 0) / 100).toLocaleString('es-SV', { style: 'currency', currency: 'USD' })
}

function clampPositiveInt(value, min = 1) {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.floor(n))
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'obra'
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo abrir la imagen seleccionada'))
    img.src = src
  })
}

async function cropToPosterBlob(file) {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(objectUrl)
    const canvas = document.createElement('canvas')
    canvas.width = TARGET_IMAGE_WIDTH
    canvas.height = TARGET_IMAGE_HEIGHT
    const ctx = canvas.getContext('2d')

    const targetRatio = TARGET_IMAGE_WIDTH / TARGET_IMAGE_HEIGHT
    const sourceRatio = img.width / img.height

    let sx = 0
    let sy = 0
    let sWidth = img.width
    let sHeight = img.height

    if (sourceRatio > targetRatio) {
      sWidth = img.height * targetRatio
      sx = (img.width - sWidth) / 2
    } else {
      sHeight = img.width / targetRatio
      sy = (img.height - sHeight) / 2
    }

    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, TARGET_IMAGE_WIDTH, TARGET_IMAGE_HEIGHT)

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((generatedBlob) => {
        if (!generatedBlob) return reject(new Error('No se pudo procesar la imagen'))
        resolve(generatedBlob)
      }, 'image/jpeg', 0.9)
    })

    return blob
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

const emptyPlayForm = {
  id: null,
  title: '',
  description: '',
  image_url: '',
  duration_minutes: 90,
  rating: 'Todo público'
}

const emptyPerformanceForm = {
  id: null,
  play_id: '',
  starts_at: fmtDateInput(new Date(Date.now() + 86400000)),
  hall: 'Gran Carpa Principal',
  capacity_total: 180,
  status: 'ACTIVE',
  general_price: 12,
  vip_price: 20
}

export default function Admin() {
  const [plays, setPlays] = useState([])
  const [performances, setPerformances] = useState([])
  const [tiers, setTiers] = useState([])
  const [orders, setOrders] = useState([])
  const [emails, setEmails] = useState([])
  const [ticketCode, setTicketCode] = useState('')
  const [playForm, setPlayForm] = useState(emptyPlayForm)
  const [performanceForm, setPerformanceForm] = useState(emptyPerformanceForm)
  const [savingPlay, setSavingPlay] = useState(false)
  const [savingPerformance, setSavingPerformance] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [playImageFile, setPlayImageFile] = useState(null)
  const [playImagePreview, setPlayImagePreview] = useState('')
  const [externalImageUrl, setExternalImageUrl] = useState('')
  const fileInputRef = useRef(null)

  const load = async () => {
    const [{ data: playsData }, { data: performanceData }, { data: tiersData }, { data: ordersData }, { data: emailsData }] = await Promise.all([
      supabase.from('plays').select('*').order('id', { ascending: true }),
      supabase.from('performances').select('*').order('starts_at', { ascending: true }),
      supabase.from('price_tiers').select('*').order('performance_id', { ascending: true }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('email_outbox').select('*').order('created_at', { ascending: false }).limit(20)
    ])

    setPlays(playsData || [])
    setPerformances(performanceData || [])
    setTiers(tiersData || [])
    setOrders(ordersData || [])
    setEmails(emailsData || [])
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    return () => {
      if (playImagePreview && playImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(playImagePreview)
      }
    }
  }, [playImagePreview])

  const playTitleById = useMemo(() => {
    return Object.fromEntries((plays || []).map((play) => [play.id, play.title]))
  }, [plays])

  const tiersByPerformance = useMemo(() => {
    const map = {}
    for (const tier of tiers || []) {
      const key = Number(tier.performance_id)
      if (!map[key]) map[key] = []
      map[key].push(tier)
    }
    return map
  }, [tiers])

  const resetPlayImageState = () => {
    if (playImagePreview && playImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(playImagePreview)
    }
    setPlayImageFile(null)
    setPlayImagePreview('')
    setExternalImageUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const onSelectPlayImage = (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      setPlayImageFile(null)
      if (playImagePreview && playImagePreview.startsWith('blob:')) URL.revokeObjectURL(playImagePreview)
      setPlayImagePreview(playForm.image_url || '')
      return
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      event.target.value = ''
      return showToast('Solo se permiten imágenes JPG, PNG o WEBP')
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      event.target.value = ''
      return showToast('La imagen pesa demasiado. El máximo recomendado es 8 MB')
    }

    const previewUrl = URL.createObjectURL(file)
    if (playImagePreview && playImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(playImagePreview)
    }

    setPlayImageFile(file)
    setPlayImagePreview(previewUrl)
    setExternalImageUrl('')
    showToast('Imagen lista. Al guardar se recortará automáticamente a 1600 × 900')
  }

  const uploadPlayImage = async (title) => {
    if (playImageFile) {
      setUploadingImage(true)
      const croppedBlob = await cropToPosterBlob(playImageFile)
      const fileName = `${Date.now()}-${slugify(title)}.jpg`
      const storagePath = `plays/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from(PLAY_IMAGES_BUCKET)
        .upload(storagePath, croppedBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/jpeg'
        })

      if (uploadError) {
        setUploadingImage(false)
        throw uploadError
      }

      const { data } = supabase.storage.from(PLAY_IMAGES_BUCKET).getPublicUrl(storagePath)
      setUploadingImage(false)
      return data?.publicUrl || ''
    }

    if (externalImageUrl.trim()) return externalImageUrl.trim()
    return playForm.image_url || ''
  }

  const savePlay = async () => {
    const title = playForm.title.trim()
    const description = playForm.description.trim()
    const duration = clampPositiveInt(playForm.duration_minutes, 1)
    const imageCandidate = externalImageUrl.trim() || playForm.image_url

    if (!title || title.length < 3) return showToast('La obra necesita un título de al menos 3 caracteres')
    if (!description || description.length < 20) return showToast('La sinopsis debe tener al menos 20 caracteres')
    if (duration < 30) return showToast('La duración debe ser de al menos 30 minutos')
    if (!playImageFile && !imageCandidate) return showToast('Debes subir una imagen o pegar una URL pública para la obra')
    if (externalImageUrl.trim() && !/^https?:\/\//i.test(externalImageUrl.trim())) {
      return showToast('La URL externa debe empezar con http:// o https://')
    }

    setSavingPlay(true)

    try {
      const image_url = await uploadPlayImage(title)
      if (!image_url) {
        setSavingPlay(false)
        return showToast('No se pudo obtener la imagen de la obra')
      }

      const payload = {
        title,
        description,
        image_url,
        duration_minutes: duration,
        rating: playForm.rating || 'Todo público'
      }

      const query = playForm.id
        ? supabase.from('plays').update(payload).eq('id', playForm.id)
        : supabase.from('plays').insert(payload)

      const { error } = await query
      setSavingPlay(false)

      if (error) return showToast('No se pudo guardar la obra. Revisa la imagen y los datos ingresados.')
      showToast(playForm.id ? 'Obra actualizada' : 'Obra creada')
      setPlayForm(emptyPlayForm)
      resetPlayImageState()
      await load()
    } catch (error) {
      setSavingPlay(false)
      setUploadingImage(false)
      showToast(`No se pudo subir la imagen: ${error.message || 'revisa el bucket y sus permisos'}`)
    }
  }

  const editPlay = (play) => {
    resetPlayImageState()
    setPlayForm({
      id: play.id,
      title: play.title || '',
      description: play.description || '',
      image_url: play.image_url || '',
      duration_minutes: clampPositiveInt(play.duration_minutes || 90, 1),
      rating: play.rating || 'Todo público'
    })
    setPlayImagePreview(play.image_url || '')
    if ((play.image_url || '').startsWith('http')) {
      setExternalImageUrl(play.image_url || '')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const removePlay = async (id) => {
    const { error } = await supabase.from('plays').delete().eq('id', id)
    if (error) return showToast('No se pudo eliminar la obra. Borra antes sus funciones si tiene compras relacionadas.')
    showToast('Obra eliminada')
    await load()
  }

  const savePerformance = async () => {
    const playId = Number(performanceForm.play_id)
    const hall = performanceForm.hall.trim()
    const capacity = clampPositiveInt(performanceForm.capacity_total, 1)
    const general = Math.round(Number(performanceForm.general_price) * 100)
    const vip = Math.round(Number(performanceForm.vip_price) * 100)

    if (!playId) return showToast('Selecciona la obra a la que pertenece la función')
    if (!performanceForm.starts_at) return showToast('Debes indicar la fecha y hora de la función')
    if (!hall || hall.length < 3) return showToast('La sala debe tener al menos 3 caracteres')
    if (capacity < 1) return showToast('La capacidad debe ser mayor que cero')
    if (!Number.isFinite(general) || general < 0) return showToast('El precio General debe ser un número válido')
    if (!Number.isFinite(vip) || vip < 0) return showToast('El precio VIP debe ser un número válido')

    setSavingPerformance(true)
    const basePayload = {
      play_id: playId,
      starts_at: new Date(performanceForm.starts_at).toISOString(),
      hall,
      status: performanceForm.status || 'ACTIVE',
      capacity_total: capacity,
      capacity_available: capacity
    }

    let performanceId = performanceForm.id

    if (performanceForm.id) {
      const existing = performances.find((item) => Number(item.id) === Number(performanceForm.id))
      const sold = Math.max(0, Number(existing?.capacity_total || capacity) - Number(existing?.capacity_available || capacity))
      const updatedPayload = {
        ...basePayload,
        capacity_available: Math.max(0, capacity - sold)
      }
      const { error } = await supabase.from('performances').update(updatedPayload).eq('id', performanceForm.id)
      if (error) {
        setSavingPerformance(false)
        return showToast('No se pudo actualizar la función')
      }
    } else {
      const { data, error } = await supabase.from('performances').insert(basePayload).select('id').single()
      if (error || !data?.id) {
        setSavingPerformance(false)
        return showToast('No se pudo crear la función')
      }
      performanceId = data.id
    }

    const existingTiers = tiersByPerformance[performanceId] || []
    const generalTier = existingTiers.find((tier) => tier.label.toLowerCase() === 'general')
    const vipTier = existingTiers.find((tier) => tier.label.toLowerCase() === 'vip')

    const tierOps = []
    if (generalTier) tierOps.push(supabase.from('price_tiers').update({ price_cents: general }).eq('id', generalTier.id))
    else tierOps.push(supabase.from('price_tiers').insert({ performance_id: performanceId, label: 'General', price_cents: general }))

    if (vipTier) tierOps.push(supabase.from('price_tiers').update({ price_cents: vip }).eq('id', vipTier.id))
    else tierOps.push(supabase.from('price_tiers').insert({ performance_id: performanceId, label: 'VIP', price_cents: vip }))

    const results = await Promise.all(tierOps)
    setSavingPerformance(false)

    if (results.some((result) => result.error)) return showToast('La función se guardó, pero hubo un problema al guardar los precios')

    showToast(performanceForm.id ? 'Función actualizada' : 'Función creada')
    setPerformanceForm(emptyPerformanceForm)
    await load()
  }

  const editPerformance = (performance) => {
    const relatedTiers = tiersByPerformance[performance.id] || []
    const generalTier = relatedTiers.find((tier) => tier.label.toLowerCase() === 'general')
    const vipTier = relatedTiers.find((tier) => tier.label.toLowerCase() === 'vip')

    setPerformanceForm({
      id: performance.id,
      play_id: performance.play_id,
      starts_at: fmtDateInput(performance.starts_at),
      hall: performance.hall || 'Gran Carpa Principal',
      capacity_total: clampPositiveInt(performance.capacity_total || 1),
      status: performance.status || 'ACTIVE',
      general_price: Number(generalTier?.price_cents || 0) / 100,
      vip_price: Number(vipTier?.price_cents || 0) / 100
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const removePerformance = async (id) => {
    const { error } = await supabase.from('performances').delete().eq('id', id)
    if (error) return showToast('No se pudo eliminar la función. Si ya tiene compras, es mejor dejarla inactiva.')
    showToast('Función eliminada')
    await load()
  }

  const redeem = async () => {
    if (!ticketCode.trim()) return showToast('Escribe el código del ticket que quieres canjear')
    const { data: ticket } = await supabase.from('tickets').select('id, status').eq('code', ticketCode.trim()).maybeSingle()
    if (!ticket) return showToast('No existe un ticket con ese código')
    if (ticket.status === 'USED') return showToast('Ese ticket ya fue marcado como usado')
    const { error } = await supabase.from('tickets').update({ status: 'USED', used_at: new Date().toISOString() }).eq('id', ticket.id)
    if (error) return showToast('No se pudo canjear el ticket')
    setTicketCode('')
    showToast('Ticket canjeado correctamente')
    await load()
  }

  return (
    <div className="adminPage">
      <section className="hero heroCircus shellCard">
        <div className="heroCopy">
          <p className="eyebrow">Backoffice</p>
          <h1 className="heroTitle">Administración de obras, funciones y tickets</h1>
          <p className="heroSub">Desde aquí puedes crear, editar y eliminar obras, administrar sus funciones y controlar las compras recientes.</p>
        </div>
        <div className="heroPanel">
          <div className="heroPanelTitle">Resumen operativo</div>
          <div className="small" style={{ color: 'rgba(255,248,231,.92)' }}>Obras: {plays.length} · Funciones: {performances.length} · Órdenes: {orders.length}</div>
          <div className="small" style={{ color: 'rgba(255,248,231,.92)' }}>Las imágenes pueden subirse aquí mismo y se ajustan a formato 1600 × 900 antes de guardarse.</div>
          <button className="btn btnPrimary" onClick={load}>Actualizar datos</button>
        </div>
      </section>

      <div className="grid adminTopGrid">
        <section className="card shellCard">
          <div className="row wrapBetween">
            <h3 style={{ marginTop: 0, marginBottom: 0 }}>{playForm.id ? 'Editar obra' : 'Agregar obra'}</h3>
            {playForm.id && <button className="btn btnGhost" onClick={() => { setPlayForm(emptyPlayForm); resetPlayImageState() }}>Cancelar edición</button>}
          </div>
          <div className="space" />
          <div className="label">Título de la obra</div>
          <input className="input" value={playForm.title} onChange={(e) => setPlayForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Ej. Fantasía Bajo la Carpa" />
          <div className="space" />
          <div className="label">Sinopsis</div>
          <textarea className="input textarea" value={playForm.description} onChange={(e) => setPlayForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Describe la obra con detalle para la cartelera" />
          <div className="space" />
          <div className="row twoCols">
            <div>
              <div className="label">Subir imagen desde la web</div>
              <input ref={fileInputRef} className="input" type="file" accept="image/png,image/jpeg,image/webp" onChange={onSelectPlayImage} />
            </div>
            <div>
              <div className="label">Duración en minutos</div>
              <input className="input" type="number" min="30" step="1" value={playForm.duration_minutes} onChange={(e) => setPlayForm((prev) => ({ ...prev, duration_minutes: clampPositiveInt(e.target.value, 30) }))} />
            </div>
          </div>
          <div className="spaceSm" />
          <div className="label">URL externa de imagen (opcional)</div>
          <input className="input" value={externalImageUrl} onChange={(e) => setExternalImageUrl(e.target.value)} placeholder="https://servidor.com/mi-imagen.jpg" />
          <div className="spaceSm" />
          <div className="small">Opción recomendada: sube el archivo aquí mismo. El sistema recorta la imagen a 1600 × 900 y la guarda en Supabase Storage. Si prefieres, también puedes pegar una URL pública directa.</div>
          {(playImagePreview || externalImageUrl || playForm.image_url) && (
            <>
              <div className="spaceSm" />
              <div className="uploadPreviewCard">
                <img className="uploadPreviewImage" src={playImagePreview || externalImageUrl || playForm.image_url || placeholderImage} alt="Vista previa de la obra" onError={(e) => { e.currentTarget.src = placeholderImage }} />
                <div className="small">Vista previa actual. Si subes archivo, el sistema lo ajusta automáticamente en formato panorámico.</div>
              </div>
            </>
          )}
          <div className="space" />
          <div className="label">Clasificación</div>
          <select className="input" value={playForm.rating} onChange={(e) => setPlayForm((prev) => ({ ...prev, rating: e.target.value }))}>
            <option>Todo público</option>
            <option>Mayores de 7</option>
            <option>Mayores de 13</option>
            <option>Mayores de 15</option>
          </select>
          <div className="spaceSm" />
          <div className="small">Si editas la obra y subes una imagen nueva, esa nueva portada reemplaza la anterior.</div>
          <div className="space" />
          <button className="btn btnPrimary" onClick={savePlay} disabled={savingPlay || uploadingImage}>{savingPlay || uploadingImage ? 'Guardando...' : playForm.id ? 'Guardar cambios' : 'Agregar obra'}</button>
        </section>

        <section className="card shellCard">
          <div className="row wrapBetween">
            <h3 style={{ marginTop: 0, marginBottom: 0 }}>{performanceForm.id ? 'Editar función' : 'Agregar función'}</h3>
            {performanceForm.id && <button className="btn btnGhost" onClick={() => setPerformanceForm(emptyPerformanceForm)}>Cancelar edición</button>}
          </div>
          <div className="space" />
          <div className="label">Obra</div>
          <select className="input" value={performanceForm.play_id} onChange={(e) => setPerformanceForm((prev) => ({ ...prev, play_id: e.target.value }))}>
            <option value="">Selecciona una obra</option>
            {plays.map((play) => <option key={play.id} value={play.id}>{play.title}</option>)}
          </select>
          <div className="space" />
          <div className="row twoCols">
            <div>
              <div className="label">Fecha y hora</div>
              <input className="input" type="datetime-local" value={performanceForm.starts_at} onChange={(e) => setPerformanceForm((prev) => ({ ...prev, starts_at: e.target.value }))} />
            </div>
            <div>
              <div className="label">Sala</div>
              <input className="input" value={performanceForm.hall} onChange={(e) => setPerformanceForm((prev) => ({ ...prev, hall: e.target.value }))} />
            </div>
          </div>
          <div className="space" />
          <div className="row threeCols">
            <div>
              <div className="label">Capacidad</div>
              <input className="input" type="number" min="1" step="1" value={performanceForm.capacity_total} onChange={(e) => setPerformanceForm((prev) => ({ ...prev, capacity_total: clampPositiveInt(e.target.value, 1) }))} />
            </div>
            <div>
              <div className="label">Precio General</div>
              <input className="input" type="number" min="0" step="0.01" value={performanceForm.general_price} onChange={(e) => setPerformanceForm((prev) => ({ ...prev, general_price: e.target.value }))} />
            </div>
            <div>
              <div className="label">Precio VIP</div>
              <input className="input" type="number" min="0" step="0.01" value={performanceForm.vip_price} onChange={(e) => setPerformanceForm((prev) => ({ ...prev, vip_price: e.target.value }))} />
            </div>
          </div>
          <div className="space" />
          <div className="label">Estado</div>
          <select className="input" value={performanceForm.status} onChange={(e) => setPerformanceForm((prev) => ({ ...prev, status: e.target.value }))}>
            <option value="ACTIVE">Activa</option>
            <option value="INACTIVE">Inactiva</option>
          </select>
          <div className="space" />
          <button className="btn btnPrimary" onClick={savePerformance} disabled={savingPerformance}>{savingPerformance ? 'Guardando...' : performanceForm.id ? 'Guardar cambios' : 'Agregar función'}</button>
        </section>
      </div>

      <div className="grid adminMiddleGrid">
        <section className="card shellCard">
          <h3 style={{ marginTop: 0 }}>Obras creadas</h3>
          <div className="small">Aquí puedes revisar la imagen, editar la sinopsis o eliminar la obra.</div>
          <div className="space" />
          <div className="stackList">
            {plays.map((play) => (
              <article className="miniCard" key={play.id}>
                <div className="miniCardImageWrap">
                  <img className="miniCardImage" src={play.image_url || placeholderImage} alt={play.title} onError={(e) => { e.currentTarget.src = placeholderImage }} />
                </div>
                <div className="miniCardBody">
                  <div className="row wrapBetween">
                    <div>
                      <div className="cardTitle">{play.title}</div>
                      <div className="meta">{play.rating || 'Todo público'} · {play.duration_minutes} min</div>
                    </div>
                    <span className="tag">#{play.id}</span>
                  </div>
                  <div className="spaceSm" />
                  <p className="cardText">{play.description}</p>
                  <div className="spaceSm" />
                  <div className="row">
                    <button className="btn" onClick={() => editPlay(play)}>Editar</button>
                    <button className="btn btnDanger" onClick={() => removePlay(play.id)}>Eliminar</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="card shellCard">
          <h3 style={{ marginTop: 0 }}>Funciones registradas</h3>
          <div className="small">Cada obra debe tener dos funciones como base, pero puedes crear más si lo necesitas.</div>
          <div className="space" />
          <div className="stackList">
            {performances.map((performance) => (
              <article className="miniCard" key={performance.id}>
                <div className="miniCardBody wide">
                  <div className="row wrapBetween">
                    <div>
                      <div className="cardTitle">{playTitleById[performance.play_id] || `Obra #${performance.play_id}`}</div>
                      <div className="meta">Función #{performance.id} · {fmtDate(performance.starts_at)}</div>
                    </div>
                    <span className="tag">{performance.status}</span>
                  </div>
                  <div className="spaceSm" />
                  <div className="row">
                    <span className="tag">{performance.hall}</span>
                    <span className="tag">Cupo: {performance.capacity_available}/{performance.capacity_total}</span>
                    {(tiersByPerformance[performance.id] || []).map((tier) => (
                      <span className="tag" key={tier.id}>{tier.label}: {money(tier.price_cents)}</span>
                    ))}
                  </div>
                  <div className="spaceSm" />
                  <div className="row">
                    <button className="btn" onClick={() => editPerformance(performance)}>Editar</button>
                    <button className="btn btnDanger" onClick={() => removePerformance(performance.id)}>Eliminar</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="grid adminBottomGrid">
        <section className="card shellCard">
          <h3 style={{ marginTop: 0 }}>Canjear ticket</h3>
          <div className="small">Escribe el código exacto del ticket para marcarlo como usado.</div>
          <div className="space" />
          <input className="input" value={ticketCode} onChange={(e) => setTicketCode(e.target.value)} placeholder="TNS-..." />
          <div className="space" />
          <button className="btn btnPrimary" onClick={redeem}>Canjear ticket</button>
        </section>

        <section className="card shellCard">
          <h3 style={{ marginTop: 0 }}>Órdenes recientes</h3>
          <div className="stackList compactStack">
            {orders.map((order) => (
              <div key={order.id} className="miniCardBody compactCard">
                <div className="row wrapBetween">
                  <strong>{order.id.slice(0, 8)}</strong>
                  <span className="tag">Qty {order.quantity}</span>
                </div>
                <div className="small">Total final: {money(order.total_cents)} · Función #{order.performance_id}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card shellCard">
          <h3 style={{ marginTop: 0 }}>Mensajes guardados</h3>
          <div className="stackList compactStack">
            {emails.map((mail) => (
              <div key={mail.id} className="miniCardBody compactCard">
                <strong>{mail.subject}</strong>
                <div className="small">{fmtDate(mail.created_at)}</div>
                <div className="small">{mail.body}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
