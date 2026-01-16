import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { MapPin, Mail, ShieldCheck, ChevronLeft, Clock, UserCheck, LogOut, Map } from 'lucide-react'

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

  // Mapping status to specific branding logic from index.css
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return { 
          label: 'Active Member', 
          classes: 'border-brand-green text-brand-green', 
          icon: <ShieldCheck className="w-4 h-4" /> 
        };
      case 'pending_location':
        return { 
          label: 'Location Pending', 
          classes: 'border-brand-terracotta text-brand-terracotta', 
          icon: <MapPin className="w-4 h-4" /> 
        };
      case 'pending_second_vouch':
        return { 
          label: 'Vouch Pending', 
          classes: 'border-brand-muted text-brand-text', 
          icon: <UserCheck className="w-4 h-4" /> // Restored UserCheck for vouching
        };
      default:
        return { 
          label: 'Inactive', 
          classes: 'border-brand-border text-brand-muted', 
          icon: <Clock className="w-4 h-4" /> 
        };
    }
  };

  const statusStyle = getStatusConfig(membershipStatus || 'inactive');

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
      <div className="artisan-container-large px-4">
        <div className="flex justify-between">
          <button onClick={() => navigate({ to: '/dashboard' })} className="nav-link-back">
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          <button className="pill-secondary" onClick={() => handleSignout()}>
            <LogOut className="w-3 h-3" />
            <span className="text-sm text-brand-green">Sign out</span>
          </button>
        </div>
        <header className="artisan-header">
          <h1 className="artisan-header-title">{fullProfile?.display_name}</h1>
        </header>

        <div className="space-y-6">
          <section className="artisan-card">
            {/* artisan-card-inner provides the recessed background */}
            <div className="artisan-card-inner">
            <div className="detail-row">
                  <div className="icon-box">
                    <Mail className="w-4 h-4 text-brand-green" />
                  </div>
                  <div>
                    <p className="text-label block mb-3">Email Address</p>
                    <p className="text-brand-dark font-medium">{fullProfile?.email}</p>
                  </div>
                </div>

                <div className="detail-row">
                  <div className="icon-box">
                    <MapPin className="w-4 h-4 text-brand-green" />
                  </div>
                  <div className="flex-1">
                    <p className="text-label block mb-3">Home Address</p>
                    <p className="text-brand-dark font-medium leading-relaxed">
                      {fullProfile?.address}
                    </p>
                  </div>
                </div>
            </div>
          </section>

          {neighborhood?.map_image_url && (
            <section className="artisan-card border-brand-terracotta">
              <div className="artisan-card-inner">
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="icon-box">
                      <Map className="w-4 h-4 text-brand-green" />
                    </div>
                    <h2 className="text-label text-lg font-semibold">{neighborhood.name} boundary area</h2>
                  </div>
                </div>
                
                <div className="rounded-lg overflow-hidden border border-brand-green/20 shadow-sm">
                  <img 
                    src={neighborhood.map_image_url} 
                    alt={`${neighborhood.name} neighborhood boundary map`}
                    className="w-full h-auto"
                  />
                </div>
                
                <div className="mt-4 flex items-start gap-2 text-xs text-brand-muted italic">
                  <ShieldCheck className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-brand-green" />
                  <p className="leading-relaxed">
                    This map shows the verified boundary of your local neighborhood registry.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Conditional Alerts using brand colors for terracotta (errors) and green (success) */}
          <div className={`${membershipStatus === 'active' ? 'alert-success' : 'alert-error'} border-dashed`}>
            <p className="alert-body italic opacity-80 px-4">
              {membershipStatus === 'active' 
                ? "Your full address is only shared with neighbors once you accept their help or they accept yours."
                : membershipStatus === 'pending_location'
                ? "Verification in progress: We are confirming your neighborhood location."
                : "Awaiting a second neighbor vouch to activate your account."}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}