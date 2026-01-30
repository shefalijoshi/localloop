import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { MapPin, Mail, ShieldCheck, ChevronLeft, LogOut, Map } from 'lucide-react'

export const Route = createFileRoute('/_auth/_app/profile-details')({
  component: ProfilePage,
})

function ProfilePage() {
  const { profile, membershipStatus } = Route.useRouteContext()
  const navigate = useNavigate()

  const { data: fullProfile, isLoading } = useQuery({
    queryKey: ['profile_email', profile?.id],
    queryFn: async () => {
      const { data: email, error } = await supabase
        .rpc('get_user_email_by_profile', { target_id: profile?.id });
      if (error) throw error;
      return { ...profile, email };
    },
    enabled: !!profile?.id,
  })

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

  const handleSignout = async () => {
    const { error } = await supabase.auth.signOut()

    if (!error) {
      navigate({ to: '/' })
    } else {
      alert(error.message)
    }
  };

  if (isLoading) {
    return (
      <div className="loading-focus-state">
        <div className="spinner-brand" />
        <p className="text-label italic">Loading your information...</p>
      </div>
    )
  }

  return (
    <div className="artisan-page-focus">
      <div className="artisan-container-large">
        <div className="flex justify-between mb-8">
          <button onClick={() => navigate({ to: '/dashboard' })} className="btn-hud">
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <button className="btn-hud btn-hud-danger" onClick={() => handleSignout()}>
          <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
        <header className="card-feature">
          <h1 className="artisan-header-title text-center">
            {fullProfile?.display_name}
          </h1>
        </header>

        <div className="space-y-4">
          <section className="card-feature border-0 shadow-2xl">
            <div className="detail-row">
              <div className="icon-box">
                <Mail className="w-4 h-4 text-brand-green" />
              </div>
              <div>
                <p className="text-label">Email</p>
                <p>{fullProfile?.email}</p>
              </div>
            </div>
            <div className="detail-row">
              <div className="icon-box">
                <MapPin className="w-4 h-4 text-brand-green" />
              </div>
              <div>
                <p className="text-label">Address</p>
                <p>{fullProfile?.address}</p>
                <p className="p-0 text-explanation">Your full address is only shared with neighbors once you accept their help or they accept yours.</p>
              </div>
            </div>        
          </section>

          {neighborhood?.map_image_url && (
            <section className="card-feature overflow-hidden border-0 shadow-2xl">
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="icon-box">
                    <Map className="w-3.5 h-3.5 text-brand-green" />
                  </div>
                  <h2 className="text-label text-lg">{neighborhood.name} boundary area</h2>
                </div>
              </div>
              <div className="relative">
                  <img 
                    src={neighborhood.map_image_url} 
                    alt={`${neighborhood.name} neighborhood boundary map`}
                    className="w-full h-auto object-cover brightness-90 contrast-125"
                  />
                <p className="text-explanation">
                  This map shows the verified boundary of your local neighborhood registry.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}