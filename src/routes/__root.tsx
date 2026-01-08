import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import type { Session, User } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import type { QueryClient } from '@tanstack/react-query'

type Profile = Database['public']['Tables']['profiles']['Row']

interface MyRouterContext {
  queryClient: QueryClient
  session: Session | null // For token management
  user: User | null       // Verified server-side identity
  profile: Profile | null 
  membershipStatus: string | null
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async ({ context }) => {
    // 1. Get Session (fast) and User (verified)
    const { data: { session } } = await supabase.auth.getSession()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { session: null, user: null, profile: null, membershipStatus: null }
    }

    // 2. Fetch Profile
    const profile = await context.queryClient.ensureQueryData({
      queryKey: ['profile', user.id],
      queryFn: async () => {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single()
        return data
      },
    })

    // 3. Fetch Membership Status only if profile exists
    let membershipStatus: string | null = null
    if (profile) {
      const membership = await context.queryClient.ensureQueryData({
        queryKey: ['membership_status', user.id],
        queryFn: async () => {
          const { data } = await supabase
            .from('neighborhood_memberships')
            .select('status')
            .eq('user_id', user.id)
            .maybeSingle()
          return data
        }
      })
      membershipStatus = membership?.status || null
    }

    return { session, user, profile, membershipStatus }
  },
  component: () => (
    <div className="min-h-screen">
      <Outlet />
    </div>
  ),
})