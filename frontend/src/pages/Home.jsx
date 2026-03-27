import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import { showToast } from '../components/Toast.jsx'

function fmtDate(iso) {
  const d = new Date(iso)
  const opt = { weekday: 'short', month: 'short', day: 'numeric' }
  const opt2 = { hour: '2-digit', minute: '2-digit' }
  return `${d.toLocaleDateString('es-SV', opt)} · ${d.toLocaleTimeString('es-SV', opt2)}`
}

const fallbackImage = '/imagenes/obra-placeholder.svg'

export default function Home() {
  const [plays, setPlays] = useState([])
  const [performances, setPerformances] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [{ data: playsData, error: playsError }, { data: performanceData, error: perfError }] = await Promise.all([
        supabase.from('plays').select('*').order('id', { ascending: true }),
        supabase.from('performances').select('id, play_id, starts_at, hall, status, capacity_available').eq('status', 'ACTIVE').order('starts_at', { ascending: true })
      ])

      if (playsError || perfError) {
        showToast('No se pudo cargar la cartelera en este momento')
      }

      setPlays(playsData || [])
      setPerformances(performanceData || [])
      setLoading(false)
    }
    load()
  }, [])

  const cards = useMemo(() => {
    return (plays || []).map((play) => {
      const related = (performances || []).filter((p) => Number(p.play_id) === Number(play.id))
      return {
        ...play,
        image_url: play.image_url || fallbackImage,
        functionsCount: related.length,
        nextDate: related[0]?.starts_at || null,
        nextHall: related[0]?.hall || 'Sala Principal'
      }
    })
  }, [plays, performances])

  return (
    <>
      <div className="hero heroCircus shellCard">
        <div className="heroCopy">
          <p className="eyebrow">Bienvenidos a la temporada 2026</p>
          <h1 className="heroTitle">El telón se abre para una noche de carpa, vértigo, música y gran espectáculo</h1>
          <p className="heroSub">
            Esta presentación reúne nuestras obras principales en una cartelera inspirada en el encanto del circo
clásico, donde cada espectáculo se vive como una experiencia visual única con una imagen protagonista,
una breve historia que te atrapa y funciones listas para que elijas la que quieras disfrutar
          </p>
          <p className="heroSub heroSubSecondary">
            Explora nuestra temporada, dejate llevar por historias llenas de magia y emocion, descubre cada obra y sus
horarios, y elige fácilmente la función que quieres vivir como si entraras a un mundo de sueños
          </p>
        </div>
        <div className="heroPanel">
          <div className="heroPanelTitle">Lo que nos hace únicos</div>
          <ul className="heroList">
            <li>Somos el mejor circo de Centroamerica.</li>
            <li>Disfruta de las mejores funciones por tiempo limitado.</li>
            <li>Compra tus entradas de forma fácil y rápida.</li>
            <li>Sin intermediarios, directo para ti.</li>
          </ul>
        </div>
      </div>

      {loading && <div className="card shellCard" style={{ marginTop: 18 }}>Cargando cartelera...</div>}

      {!loading && (
        <div className="grid playsGrid">
          {cards.map((play) => (
            <article className="card playCard shellCard" key={play.id}>
              <div className="posterWrap">
                <img className="posterImage" src={play.image_url} alt={play.title} onError={(e) => { e.currentTarget.src = fallbackImage }} />
                <div className="posterOverlay">
                  <span className="badge">{play.rating || 'Todo público'}</span>
                  <span className="badge badgeAlt">{play.duration_minutes ? `${play.duration_minutes} min` : 'Duración variable'}</span>
                </div>
              </div>
              <h3 className="cardTitle">{play.title}</h3>
              <div className="meta">{play.functionsCount} funciones activas · {play.nextHall}</div>
              <div className="spaceSm" />
              <p className="cardText">{(play.description || '').slice(0, 160)}{(play.description || '').length > 160 ? '…' : ''}</p>
              <div className="spaceSm" />
              <div className="row wrapBetween">
                <span className="tag">{play.nextDate ? `Próxima: ${fmtDate(play.nextDate)}` : 'Fecha por definir'}</span>
                <span className="tag">Obra #{play.id}</span>
              </div>
              <div className="space" />
              <Link className="btn btnPrimary playCardCta" to={`/obra/${play.id}`}>Ver obra y funciones</Link>
            </article>
          ))}
          {cards.length === 0 && <div className="card shellCard">No hay obras activas aún.</div>}
        </div>
      )}
    </>
  )
}
