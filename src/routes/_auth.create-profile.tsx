import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate, useRouter, redirect } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { getCoordsFromAddress, type Coords } from '../lib/geocoding'

export const Route = createFileRoute('/_auth/create-profile')({
  beforeLoad: ({ context }) => {
    // If name and hood are set, this page is no longer for you.
    if (context.profile?.display_name && context.profile?.neighborhood_id) {
      throw redirect({ to: '/' }) // Go to Traffic Cop to find next step
    }
  },
  component: CreateProfileComponent,
})

function CreateProfileComponent() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { profile } = Route.useRouteContext()
  
  // --- Form State ---
  const [name, setName] = useState(profile?.display_name || '')
  const [neighborhoodName, setNeighborhoodName] = useState('')
  const [address, setAddress] = useState(profile?.address || '')
  const [inviteCode, setInviteCode] = useState('')
  const [coords, setCoords] = useState<Coords | null>(null)
  
  // --- UI State ---
  const [step, setStep] = useState<'name' | 'choice' | 'executing'>('name')
  const [method, setMethod] = useState<'join' | 'create' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isValidatingLocation, setIsValidatingLocation] = useState(false)

  // --- 1. Clean Debounced Effect ---

  useEffect(() => {
    if (address.length < 5) {
      setCoords(null)
      return
    }

    setIsValidatingLocation(true)
    const delayDebounceFn = setTimeout(async () => {
      const result = await getCoordsFromAddress(address)
      setCoords(result)
      setIsValidatingLocation(false)
    }, 600)

    return () => clearTimeout(delayDebounceFn)
  }, [address])

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

  // --- 2. Join Path ---
  const handleJoin = async () => {
    if (!inviteCode || !coords) return
    setStep('executing')
    setError(null)

    try {
      await updateProfile();

      const { data: status, error: rpcError } = await supabase.rpc('join_neighborhood', {
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

  // --- 3. Create Path ---
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
    <div className="min-h-screen bg-[#F9F7F2] flex flex-col items-center pt-12 pb-20 px-6">
      <div className="w-full max-w-sm">
        
        {/* Error Messaging */}
        {error && (
          <div className="mb-8 p-4 bg-[#FFF5F2] text-[#BC6C4D] rounded-2xl text-xs font-medium border border-[#BC6C4D]/20 animate-in fade-in zoom-in">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          </div>
        )}

        {/* --- STEP 1: IDENTITY --- */}
        {step === 'name' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="text-center mb-10">
              <div className="inline-block px-3 py-1 bg-[#EBE7DE] rounded-full text-[10px] uppercase tracking-[0.2em] font-bold text-[#6B6658] mb-4">
                {profile?.display_name ? 'Identity Confirmation' : 'Step 01 — Identity'}
              </div>
              
              <h1 className="text-4xl font-serif text-[#2D2D2D] mb-3">
                {profile?.display_name ? 'Confirm Profile' : 'Resident Profile'}
              </h1>
              
              <p className="text-[#6B6658] text-sm leading-relaxed px-4">
                {profile?.display_name 
                  ? 'Review your details before proceeding to your neighborhood.' 
                  : 'Please provide your details as they should appear to your neighbors.'}
              </p>
            </header>

            <div className="artisan-card p-8 space-y-8">
              {/* Full Name Field */}
              <div className="group">
                <label className="block text-[10px] uppercase tracking-[0.15em] font-bold text-[#A09B8E] mb-3 ml-1">
                  Full Name
                </label>
                <input
                  className="artisan-input text-sm"
                  placeholder="e.g. Julianne Graham"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Address Field */}
              <div className="group">
                <label className="block text-[10px] uppercase tracking-[0.15em] font-bold text-[#A09B8E] mb-3 ml-1">
                  Residential Address
                </label>
                <div className="relative">
                  <input
                    className={`artisan-input text-sm pr-12 transition-all duration-500 ${
                      coords ? 'border-[#4A5D4E]/40 bg-[#F2F0E9]/40' : ''
                    }`}
                    placeholder="Search your street address..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                  
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
                    {isValidatingLocation && (
                      <div className="h-4 w-4 border-2 border-[#4A5D4E] border-t-transparent rounded-full animate-spin" />
                    )}
                    {coords && !isValidatingLocation && (
                      <div className="text-[#4A5D4E] animate-in zoom-in duration-300">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Verification Badge */}
                {coords && (
                  <p className="mt-3 text-[10px] text-[#4A5D4E] font-bold flex items-center gap-1.5 ml-1 animate-in fade-in slide-in-from-left-2">
                    <span className="h-1 w-1 bg-[#4A5D4E] rounded-full"></span>
                    LOCATION VERIFIED
                  </p>
                )}
              </div>

              {/* Primary Action */}
              <div className="pt-2">
                <button 
                  onClick={() => setStep('choice')}
                  disabled={name.length < 2 || !coords || isValidatingLocation}
                  className="btn-primary w-full shadow-xl shadow-[#4A5D4E]/10 flex items-center justify-center"
                >
                  {profile?.display_name ? 'Confirm & Continue' : 'Continue to Access'}
                </button>
              </div>
            </div>
            
            <footer className="mt-12 text-center">
              <p className="text-[10px] uppercase tracking-widest text-[#A09B8E]">
                Secure Residential Network
              </p>
            </footer>
          </div>
        )}

        {/* --- STEP 2: CHOICE --- */}
        {step === 'choice' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="text-center mb-10">
              <div className="inline-block px-3 py-1 bg-[#EBE7DE] rounded-full text-[10px] uppercase tracking-[0.2em] font-bold text-[#6B6658] mb-4">
                Step 02 — Access
              </div>
              <h2 className="text-3xl font-serif text-[#2D2D2D] mb-3">Welcome, {name.split(' ')[0]}</h2>
              <p className="text-[#6B6658] text-sm px-4">Select your neighborhood entry method.</p>
            </header>

            <div className="grid gap-5">
              <button 
                onClick={() => setMethod('join')}
                className={`artisan-card p-6 text-left transition-all border-2 ${
                  method === 'join' ? 'border-[#4A5D4E] bg-white' : 'border-transparent opacity-80'
                }`}
              >
                <div className="flex items-center gap-4 mb-3">
                  <div className="h-10 w-10 rounded-full bg-[#F2F0E9] flex items-center justify-center text-[#4A5D4E]">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                  </div>
                  <h3 className="font-serif text-xl text-[#2D2D2D]">Join Existing</h3>
                </div>
                <p className="text-xs text-[#6B6658] leading-relaxed">I have been provided an invite code by a neighbor.</p>
                {method === 'join' && (
                  <div className="mt-4 pt-4 border-t border-[#F2F0E9] animate-in zoom-in">
                    <input
                      className="artisan-input text-lg tracking-[0.3em] uppercase placeholder:tracking-normal"
                      placeholder="Invite Code"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    />
                  </div>
                )}
              </button>

              <button 
                onClick={() => setMethod('create')}
                className={`artisan-card p-6 text-left transition-all border-2 ${
                  method === 'create' ? 'border-[#BC6C4D] bg-white' : 'border-transparent opacity-80'
                }`}
              >
                <div className="flex items-center gap-4 mb-3">
                  <div className="h-10 w-10 rounded-full bg-[#F9F3F1] flex items-center justify-center text-[#BC6C4D]">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                  </div>
                  <h3 className="font-serif text-xl text-[#2D2D2D]">Establish New</h3>
                </div>
                <p className="text-xs text-[#6B6658] leading-relaxed">I am the first resident in this area to register.</p>
                {method === 'create' && (
                  <div className="mt-4 pt-4 border-t border-[#F9F3F1] animate-in zoom-in">
                    <input
                      className="artisan-input text-sm"
                      placeholder="Neighborhood Name (e.g. Oak St)"
                      value={neighborhoodName}
                      onChange={(e) => setNeighborhoodName(e.target.value)}
                    />
                  </div>
                )}
              </button>
            </div>

            <div className="mt-10">
              <button 
                disabled={!method || (method === 'join' && !inviteCode) || (method === 'create' && !neighborhoodName)}
                className="btn-primary w-full shadow-lg shadow-[#4A5D4E]/10"
                onClick={() => method === 'join' ? handleJoin() : handleCreate()}
              >
                Confirm Registration
              </button>
            </div>
          </div>
        )}

        {/* --- STEP 3: EXECUTING --- */}
        {step === 'executing' && (
          <div className="text-center py-20 animate-in fade-in">
            <div className="h-12 w-12 border-4 border-[#4A5D4E] border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <h3 className="font-serif text-xl text-[#2D2D2D]">Securing Profile</h3>
            <p className="text-sm text-[#6B6658] mt-2">Connecting to your neighborhood...</p>
          </div>
        )}

        {/* Trust Footer */}
        <footer className="mt-12 text-center">
          <p className="text-[10px] uppercase tracking-widest text-[#A09B8E] opacity-60">
            Secure Civic Network • Verified Residents Only
          </p>
        </footer>
      </div>
    </div>
  )
}