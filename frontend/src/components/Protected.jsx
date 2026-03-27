import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { Navigate } from 'react-router-dom'

export default function Protected({ children }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)

  useEffect(() => {
    const sync = async (sess) => {
      if (!sess) {
        setSession(null)
        setLoading(false)
        return
      }
      const { data: u, error } = await supabase.auth.getUser()
      if (error || !u?.user) {
        await supabase.auth.signOut()
        setSession(null)
        setLoading(false)
        return
      }
      setSession(sess)
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => sync(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      sync(sess)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) return <div className="card">Cargando...</div>
  if (!session) return <Navigate to="/login" replace />
  return children
}
