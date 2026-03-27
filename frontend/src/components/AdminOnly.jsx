import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { Navigate } from 'react-router-dom'

export default function AdminOnly({ children }) {
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session?.user?.id) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.session.user.id).maybeSingle()
        setAllowed(profile?.role === 'ADMIN')
      }
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess)
      if (sess?.user?.id) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', sess.user.id).maybeSingle()
        setAllowed(profile?.role === 'ADMIN')
      } else {
        setAllowed(false)
      }
      setLoading(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) return <div className="card">Cargando...</div>
  if (!session) return <Navigate to="/login" replace />
  if (!allowed) return <Navigate to="/" replace />
  return children
}
