import { createFileRoute, Outlet, redirect, useRouteContext, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { ShieldCheck, UserPlus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

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
  const [showMapToast, setShowMapToast] = useState(false)
  const hasShownToast = useRef(false)

  const { data: neighborhood } = useQuery({
    queryKey: ['neighborhood', profile?.neighborhood_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('neighborhoods')
        .select('name, map_image_url')
        .eq('id', profile?.neighborhood_id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!profile?.neighborhood_id,
  })

  useEffect(() => {
    const shouldShowWelcome = sessionStorage.getItem('showNeighborhoodWelcome')
    
    if (shouldShowWelcome === 'true' && neighborhood && !hasShownToast.current) {
      hasShownToast.current = true
      sessionStorage.removeItem('showNeighborhoodWelcome')
      
      setTimeout(() => {
        setShowMapToast(true)
        
        setTimeout(() => setShowMapToast(false), 6000)
      }, 0)
    }
  }, [neighborhood])

  return (
    
    <div className="min-h-screen">
      <main className="flex-1 w-full mx-auto px-6 pt-6">
        {/* Global Identity Bar: Branding Left, Profile Right */}
        <header className="mb-4 flex justify-between items-center border-b border-brand-border pb-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="LocalLoop" 
                className="h-14 w-auto"
              />
              <div className="flex flex-col">
                {/* <span className="text-xl font-bold text-brand-green">LocalLoop</span> */}
                <span className="text-xl text-brand-muted font-serif tracking-tight">
                  {neighborhood?.name || 'Local Neighborhood'}
                </span>
              </div>
            </Link>
          </div>

          <Link 
            to="/profile-details" 
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

        {showMapToast && neighborhood && (
          <div className="fixed top-24 right-6 z-50 animate-in slide-in-from-top-2 fade-in duration-500">
            <div className="artisan-card border-brand-green shadow-xl max-w-sm">
              <div className="p-4 flex gap-3 items-start">
                {neighborhood.map_image_url && (
                  <img 
                    src={neighborhood.map_image_url} 
                    alt="Neighborhood" 
                    className="w-16 h-16 rounded-lg border border-brand-green/20 flex-shrink-0 object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <ShieldCheck className="w-4 h-4 text-brand-green flex-shrink-0" />
                    <p className="font-semibold text-sm text-brand-dark">
                      Welcome to {neighborhood.name}!
                    </p>
                  </div>
                  <p className="text-xs text-brand-muted leading-relaxed">
                    Click your profile to view your neighborhood map
                  </p>
                </div>
                <button 
                  onClick={() => setShowMapToast(false)}
                  className="text-brand-muted hover:text-brand-dark transition-colors flex-shrink-0 -mt-1"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

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