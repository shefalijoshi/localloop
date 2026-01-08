import { useState, useEffect } from 'react'
import { createFileRoute, useRouter, redirect } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { getCoordsFromAddress, type GeocodingResult } from '../lib/geocoding'

export const Route = createFileRoute('/_auth/create-profile')({
  beforeLoad: ({ context }) => {
    if (context.profile?.display_name && context.profile?.neighborhood_id) {
      throw redirect({ to: '/' })
    }
  },
  component: CreateProfileComponent,
})

function CreateProfileComponent() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { profile } = Route.useRouteContext()
  
  const [name, setName] = useState(profile?.display_name || '')
  const [neighborhoodName, setNeighborhoodName] = useState('')
  const [address, setAddress] = useState(profile?.address || '')
  const [inviteCode, setInviteCode] = useState('')
  const [coords, setCoords] = useState<{lat:number, lng: number} | null>(null)
  
  const [step, setStep] = useState<'name' | 'choice' | 'executing'>('name')
  const [method, setMethod] = useState<'join' | 'create' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isValidatingLocation, setIsValidatingLocation] = useState(false)

  useEffect(() => {
    if (address.length < 5) {
      setCoords(null);
      return;
    }
  
    const controller = new AbortController();
    setIsValidatingLocation(true);
  
    const delayDebounceFn = setTimeout(async () => {
      try {
        const result = await getCoordsFromAddress(address, controller.signal);
        if (result) {
          setCoords({ lat: result.lat, lng: result.lng });
        } else {
          setCoords(null);
        }
      } finally {
        setIsValidatingLocation(false);
      }
    }, 600);
  
    return () => {
      clearTimeout(delayDebounceFn);
      controller.abort(); // Cancels the fetch if user types again
    };
  }, [address]);

  const updateProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('profiles')
      .update({ 
        display_name: name, 
        address: address // This ensures the latest address is saved
      })
      .eq('user_id', user?.id);
    
    if (error) throw error;
  };

  const handleJoin = async () => {
    if (!inviteCode || !coords) return
    setStep('executing')
    setError(null)

    try {
      await updateProfile();
      const { error: rpcError } = await supabase.rpc('join_neighborhood', {
        invite_code_text: inviteCode.trim().toUpperCase(),
        user_lat: coords.lat,
        user_lng: coords.lng
      })
      if (rpcError) throw rpcError
      await queryClient.invalidateQueries()
      await router.invalidate()
      window.location.replace('/')
    } catch (err: any) {
      setError(err.message || 'Failed to join neighborhood')
      setStep('choice')
    }
  }

  const handleCreate = async () => {
    if (!name || !neighborhoodName || !coords || !address) return
    setStep('executing')
    setError(null)

    try {
      await updateProfile();
      const { error: rpcError } = await supabase.rpc('initialize_neighborhood', {
        neighborhood_name: neighborhoodName.trim(),
        user_lat: coords.lat,
        user_lng: coords.lng
      })

      if (rpcError) {
        if (rpcError.message.includes('COLLISION')) {
          setError(rpcError.message.replace('COLLISION:', ''))
          setMethod('join') 
        } else {
          throw rpcError
        }
        setStep('choice')
        return
      }

      await queryClient.invalidateQueries()
      await router.invalidate()
      window.location.replace('/')
    } catch (err: any) {
      setError(err.message || 'Failed to create neighborhood')
      setStep('choice')
    }
  }

  return (
    <div className="artisan-page-focus pt-12 pb-20 px-6">
      <div className="w-full max-w-md">
        
        {error && (
          <div className="alert-error mb-8 animate-in duration-300">
            <div className="flex items-center justify-center gap-2">
              <span className="alert-title mb-0">{error}</span>
            </div>
          </div>
        )}

        {step === 'name' && (
          <div className="animate-in slide-in-from-bottom-4 duration-700">
            <header className="artisan-header">
              <div className="badge-pill mb-4">
                {profile?.display_name ? 'Identity Confirmation' : 'Step 01 — Identity'}
              </div>
              <h1 className="artisan-header-title">
                {profile?.display_name ? 'Confirm Profile' : 'Resident Profile'}
              </h1>
              <p className="artisan-header-description">
                {profile?.display_name 
                  ? 'Review your details before proceeding to your neighborhood.' 
                  : 'Please provide your details as they should appear to your neighbors.'}
              </p>
            </header>

            <div className="artisan-card">
              <div className="artisan-card-inner space-y-8">
                <div>
                  <label className="text-label block mb-3 ml-1">Full Name</label>
                  <input
                    className="artisan-input text-sm"
                    placeholder="e.g. Julianne Graham"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-label block mb-3 ml-1">Residential Address</label>
                  <div className="input-adornment-wrapper">
                    <input
                      className={`artisan-input text-sm pr-12 transition-all duration-500 ${
                        coords ? 'border-brand-green/40 bg-brand-stone/40' : ''
                      }`}
                      placeholder="Search your street address..."
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                    <div className="input-adornment-right">
                      {isValidatingLocation && (
                        <div className="h-4 w-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
                      )}
                      {coords && !isValidatingLocation && (
                        <div className="text-brand-green animate-in zoom-in duration-300">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                  {coords && (
                    <p className="text-verified animate-in slide-in-from-left-2">
                      Location Verified
                    </p>
                  )}
                </div>

                <div className="pt-2">
                  <button 
                    onClick={() => setStep('choice')}
                    disabled={name.length < 2 || !coords || isValidatingLocation}
                    className="btn-primary"
                  >
                    {profile?.display_name ? 'Confirm & Continue' : 'Continue to Access'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'choice' && (
          <div className="animate-in slide-in-from-bottom-4 duration-700">
            <header className="artisan-header">
              <div className="badge-pill mb-4">Step 02 — Access</div>
              <h2 className="artisan-header-title">Welcome, {name.split(' ')[0]}</h2>
              <p className="artisan-header-description">Select your neighborhood entry method.</p>
            </header>

            <div className="grid gap-5">
              <button 
                onClick={() => setMethod('join')}
                className={`artisan-card text-left transition-all border-2 ${
                  method === 'join' ? 'border-brand-green' : 'border-transparent'
                }`}
              >
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="icon-box text-brand-green">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                    </div>
                    <h3 className="artisan-card-title text-xl">Join Existing</h3>
                  </div>
                  <p className="artisan-meta-tiny">I have been provided an invite code by a neighbor.</p>
                  {method === 'join' && (
                    <div className="mt-4 pt-4 border-t border-brand-stone animate-in zoom-in">
                      <input
                        className="artisan-input text-lg tracking-[0.3em] uppercase placeholder:tracking-normal"
                        placeholder="Invite Code"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      />
                    </div>
                  )}
                </div>
              </button>

              <button 
                onClick={() => setMethod('create')}
                className={`artisan-card text-left transition-all border-2 ${
                  method === 'create' ? 'border-brand-terracotta' : 'border-transparent'
                }`}
              >
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="icon-box text-brand-terracotta bg-brand-terracotta/5">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                    </div>
                    <h3 className="artisan-card-title text-xl">Establish New</h3>
                  </div>
                  <p className="artisan-meta-tiny">I am the first resident in this area to register.</p>
                  {method === 'create' && (
                    <div className="mt-4 pt-4 border-t border-brand-terracotta/10 animate-in zoom-in">
                      <input
                        className="artisan-input text-sm"
                        placeholder="Neighborhood Name (e.g. Oak St)"
                        value={neighborhoodName}
                        onChange={(e) => setNeighborhoodName(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </button>
            </div>

            <div className="mt-10">
              <button 
                disabled={!method || (method === 'join' && !inviteCode) || (method === 'create' && !neighborhoodName)}
                className="btn-primary"
                onClick={() => method === 'join' ? handleJoin() : handleCreate()}
              >
                Confirm Registration
              </button>
            </div>
          </div>
        )}

        {step === 'executing' && (
          <div className="loading-focus-state">
            <div className="spinner-brand" />
            <h3 className="artisan-card-title text-xl text-center">Securing Profile</h3>
            <p className="artisan-header-description mt-2">Connecting to your neighborhood...</p>
          </div>
        )}

        <footer className="mt-12 text-center mb-8">
          <p className="text-brand-muted mt-4">
            Verified Residents Only
          </p>
        </footer>
      </div>
    </div>
  )
}