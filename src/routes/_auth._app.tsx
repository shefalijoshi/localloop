import { createFileRoute, Outlet, redirect, useRouteContext, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { UserPlus } from 'lucide-react'

export const Route = createFileRoute('/_auth/_app')({
  beforeLoad: ({ context }) => {
    if (context.membershipStatus !== 'active') {
      throw redirect({ to: '/' })
    }
  },
  component: AppLayout
})

function AppLayout() {
  const { profile } = useRouteContext({ from: '/_auth/_app' })

  const { data: neighborhood } = useQuery({
    queryKey: ['neighborhood', profile?.neighborhood_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('neighborhoods')
        .select('name')
        .eq('id', profile?.neighborhood_id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!profile?.neighborhood_id,
  })

  return (
    /*bg-[#F9F7F2] */
    <div className="min-h-screen">
      <main className="flex-1 w-full mx-auto px-6 pt-6">
        {/* Global Identity Bar: Branding Left, Profile Right */}
        <header className="mb-4 flex justify-between items-center border-b border-brand-border pb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-serif text-[#2D2D2D] tracking-tight">
              {neighborhood?.name || 'Local Neighborhood'}
            </h1>
          </div>

          <Link 
            to="/profile" 
            className="h-10 w-10 rounded-full border-2 border-[#EBE7DE] overflow-hidden bg-white shadow-sm hover:border-[#4A5D4E] transition-all flex items-center justify-center shrink-0"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-[#F2F0E9] text-[#4A5D4E] font-bold text-xs uppercase">
                {profile?.display_name?.charAt(0)}
              </div>
            )}
          </Link>
        </header>

        <Outlet />
        
        <footer className="mt-12 text-center pb-8">
        <Link 
          to="/invite" 
          className="link-standard"
        >
          <UserPlus className="w-4 h-4" />
          <span className="text-label">Invite to Registry</span>
        </Link>
        <p className="text-brand-muted mt-4">
          Secure Network • Verified Residents Only
        </p>
      </footer>
      </main>
    </div>
  )
}