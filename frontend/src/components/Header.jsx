import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import { showToast } from './Toast.jsx'

export default function Header() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState('')
  const nav = useNavigate()

  useEffect(() => {
    const sync = async (sess) => {
      if (!sess) {
        setSession(null)
        setRole('')
        return
      }

      const { data: u, error: uErr } = await supabase.auth.getUser()
      if (uErr || !u?.user) {
        await supabase.auth.signOut()
        setSession(null)
        setRole('')
        return
      }

      setSession(sess)
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', u.user.id).maybeSingle()
      setRole(profile?.role || '')
    }

    supabase.auth.getSession().then(({ data }) => sync(data.session))

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      sync(sess)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const logout = async () => {
    const { error } = await supabase.auth.signOut()
    setSession(null)
    setRole('')
    if (error) showToast('Sesión cerrada de forma forzada')
    else showToast('Sesión cerrada')
    nav('/')
  }

  return (
    <div className="nav shellCard">
      <div className="brand">
        <div className="logo">TN</div>
        <div>
          <div className="brandTitle">Teatro Nacional</div>
          <div className="small">Cartelera de obras y venta de tickets</div>
        </div>
        <span className="badge">Temporada circense</span>
      </div>

      <div className="navlinks">
        <Link className="btn btnGhost" to="/">Cartelera</Link>
        {session && <Link className="btn btnGhost" to="/mis-tickets">Mis tickets</Link>}
        {session && <Link className="btn btnGhost" to="/cuenta">Cuenta</Link>}
        {role === 'ADMIN' && <Link className="btn btnPrimary" to="/admin">Admin</Link>}
        {!session && <Link className="btn btnPrimary" to="/login">Entrar</Link>}
        {!session && <Link className="btn" to="/register">Crear cuenta</Link>}
        {session && <button className="btn btnDanger" onClick={logout}>Salir</button>}
      </div>
    </div>
  )
}
