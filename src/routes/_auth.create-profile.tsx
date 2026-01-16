import { useState, useEffect } from 'react'
import { createFileRoute, useRouter, redirect } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { getCoordsFromAddress, getDistanceInMeters } from '../lib/geocoding'
import { User, MapPin, ShieldCheck, Key, Home, Dot, ChevronLeft } from 'lucide-react'
import { PasscodeInput } from '../components/PasscodeInput'

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
  const [isLocationVerified, setIsLocationVerified] = useState<boolean>(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  
  const [step, setStep] = useState<'name' | 'choice' | 'executing'>('name')
  const [method, setMethod] = useState<'join' | 'create' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isGettingCoords, setIsGettingCoords] = useState(false)

  useEffect(() => {
    if (address.length < 5) {
      setCoords(null);
      return;
    }
    const controller = new AbortController();
    setIsGettingCoords(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const result = await getCoordsFromAddress(address, controller.signal);
        if (result) {
          setCoords({ lat: result.lat, lng: result.lng });
        } else {
          setCoords(null);
        }
      } finally {
        setIsGettingCoords(false);
      }
    }, 600);
    return () => {
      clearTimeout(delayDebounceFn);
      controller.abort();
    };
  }, [address]);

  const updateProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name, address: address })
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
        invite_code_text: inviteCode.trim(),
        user_lat: coords.lat,
        user_lng: coords.lng,
        locationVerified: isLocationVerified
      })
      if (rpcError) throw rpcError

      sessionStorage.setItem('showNeighborhoodWelcome', 'true')
      
      await queryClient.invalidateQueries()
      await router.invalidate()
      window.location.replace('/')
    } catch (err: any) {
      setError(err.message || 'Failed to join neighborhood')
      setStep('choice')
    }
  }

  const handleCreate = async () => {
    if (!name || !neighborhoodName || !coords || !address || !isLocationVerified) return
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

      sessionStorage.setItem('showNeighborhoodWelcome', 'true')

      await queryClient.invalidateQueries()
      await router.invalidate()
      window.location.replace('/')
    } catch (err: any) {
      setError(err.message || 'Failed to create neighborhood')
      setStep('choice')
    }
  }

  const verifyWithWatch = () => {
    if (!coords) {
      setVerificationError("Please enter your address first.");
      return;
    }

    setVerificationError(null);
    setIsVerifying(true);
    setIsLocationVerified(false);

    const addressCoords: [number, number] = [coords.lng, coords.lat];

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const userCoords: [number, number] = [position.coords.longitude, position.coords.latitude];
        setAccuracy(position.coords.accuracy);

        const distance = getDistanceInMeters(userCoords, addressCoords);

        if (distance <= 100) {
          setIsLocationVerified(true);
          setIsVerifying(false);
          navigator.geolocation.clearWatch(watchId);
          setVerificationError(null);
        }
      },
      (error) => {
        console.log(error);
        navigator.geolocation.clearWatch(watchId);
        setIsVerifying(false);
        setVerificationError("Location access denied. Please use manual verification with a neighbor." );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      setIsLocationVerified(false);
      setIsVerifying(false);
      setVerificationError("Your current location could not be verified. Please use manual verification with a neighbor.");
    }, 15000);
  };

  return (
    <div className="artisan-page-focus pt-2 pb-20 px-6">
      <div className="artisan-container-large">
        <div className="flex items-center justify-center mb-1">
          <img 
            src="/logo.png" 
            alt="LocalLoop" 
            className="h-10 w-auto"
          />
          <span className="text-2xl font-bold text-brand-terracotta">LocalLoop</span>
        </div>
        {error && (
          <div className="alert-error mb-8 animate-in border-dashed">
            <span className="alert-title mb-0">{error}</span>
          </div>
        )}

        {step === 'name' && (
          <div className="animate-in slide-in-from-bottom-4 duration-700">
            <header className="artisan-header">
              <h1 className="artisan-header-title">Resident Profile</h1>
              <p className="artisan-header-description">
                Please provide your details as they should appear to your neighbors.
              </p>
            </header>

            <div className="artisan-card border-brand-green">
              <div className="artisan-card-inner space-y-2 text-left">
                
                {/* Name Input Group */}
                <div className="detail-row border-b-0 pb-0 items-start">
                  <div className="icon-box">
                    <User className="w-4 h-4 text-brand-green" />
                  </div>
                  <div className="flex-1">
                  <label className="text-label block mb-3 ml-1">Full Name</label>
                  <input
                    className="artisan-input text-sm"
                    placeholder="e.g. Julianne Graham"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  </div>
                </div>

                {/* Address Input Group */}
                <div className="detail-row border-b-0 items-start">
                  <div className="icon-box">
                    <MapPin className="w-4 h-4 text-brand-green" />
                  </div>
                  <div className="flex-1">
                  <label className="text-label block mb-3 ml-1">Residential Address</label>                    <div className="input-adornment-wrapper">
                      <input
                        className={`artisan-input text-sm pr-12 transition-all duration-500 ${
                          coords ? 'border-brand-green/40 bg-brand-stone' : ''
                        }`}
                        placeholder="Search your street address..."
                        value={address}
                        onChange={(e) => {setAddress(e.target.value); setVerificationError(null)}}
                      />
                      {/* <div className="input-adornment-right">
                        {isGettingCoords && (
                          <div className="h-4 w-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
                        )}
                        {coords && !isGettingCoords && (
                          <div className="text-brand-green animate-in zoom-in">
                            <ShieldCheck className="w-5 h-5" />
                          </div>
                        )}
                      </div> */}
                    </div>
                  </div>
                </div>
                {coords && (<div className={`flex justify-center animate-in slide-in-from-top-2 ${isVerifying || verificationError ? '' : 'underline'}`}>
                  {!isLocationVerified ? (
                    <button 
                      type="button"
                      onClick={verifyWithWatch}
                      disabled={!address || !coords}
                    >
                      {isVerifying ? 
                        <span><Dot className="animate-ping inline"/> Searching for GPS (Accuracy: {accuracy?.toFixed(0)} meters)</span>
                      : verificationError ? `${verificationError}` : "Verify My Location"}
                    </button>
                  ) : (
                    <div className="badge-pill border border-brand-green/20 text-brand-green py-1.5 flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span className="alert-meta-tiny">Location Verified</span>
                    </div>
                  )}
                </div>)}
              </div>
            </div>
            <div className="pt-2">
              <button 
                onClick={() => setStep('choice')}
                disabled={name.length < 2 || !coords || isGettingCoords}
                className="btn-primary"
              >
                Continue to Access
              </button>
              </div>
          </div>
        )}

        {step === 'choice' && (
          <div className="animate-in slide-in-from-bottom-4 duration-700 text-center">
            <button 
              onClick={() => setStep('name')}
              className="nav-link-back"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <header className="artisan-header">
              <h2 className="artisan-header-title text-2xl">Neighborhood Entry</h2>
              <p className="artisan-header-description">Welcome, {name.split(' ')[0]}!</p>
            </header>

            <div className="grid gap-5 text-left">
              <button 
                onClick={() => setMethod('join')}
                className={`artisan-card transition-all ${
                  method === 'join' ? 'border-brand-green' : 'border-transparent'
                }`}
              >
                <div className="p-1">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="icon-box text-brand-green">
                      <Key className="w-4 h-4" />
                    </div>
                    <h3 className="artisan-card-title text-lg">Join Existing</h3>
                  </div>
                  <p className="leading-relaxed">You have been provided an invite code by a neighbor.</p>
                  {method === 'join' && (
                  <div className="mt-4 pt-4 border-t border-brand-stone animate-in zoom-in">
                    {/* Label for context */}
                        <label className="text-label block mb-4 text-center">Enter 6-Digit Invite Code</label>
                        
                        {/* Reusing the specialized component */}
                        <PasscodeInput 
                          value={inviteCode} 
                          onChange={setInviteCode} 
                        />
                      </div>
                    )}
                  </div>
              </button>

              <button 
                onClick={() => setMethod('create')}
                disabled={!isLocationVerified}
                className={`artisan-card transition-all ${
                  method === 'create' ? 'border-brand-terracotta' : 'border-transparent'
                }`}
              >
                <div className="p-1">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="icon-box text-brand-terracotta bg-brand-terracotta/5 border-brand-terracotta/20">
                      <Home className="w-4 h-4" />
                    </div>
                    <h3 className="text-wrap artisan-card-title text-lg">Establish New</h3>
                  </div>
                  <p className="leading-relaxed">You are the first resident in this area to register.</p>
                  <p className='italic'>{isLocationVerified ? '' : 'Verify your location in the previous step to establish a new neighborhood.'}</p>
                  {method === 'create' && isLocationVerified && (
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
            <h3 className="artisan-header-title text-xl">Securing Profile</h3>
            <p className="artisan-header-description">Connecting to your neighborhood...</p>
          </div>
        )}

        <footer className="mt-12 text-center mb-8">
          <p className="text-brand-muted">
            Verified Residents Only
          </p>
        </footer>
      </div>
    </div>
  )
}