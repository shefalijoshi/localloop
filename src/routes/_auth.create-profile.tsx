import { useState, useEffect } from 'react'
import { createFileRoute, useRouter, redirect } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { getCoordsFromAddress, getDistanceInMeters } from '../lib/geocoding'
import { User, MapPin, ShieldCheck, Dot, ChevronLeft } from 'lucide-react'
import { JoinNeighborhood } from '../components/JoinNeighborhood'
import { CreateNeighborhood } from '../components/CreateNeighborhood'

export const Route = createFileRoute('/_auth/create-profile')({
  beforeLoad: ({ context }) => {
    if (context.profile?.display_name && context.profile?.neighborhood_id && context.membershipStatus  && context.membershipStatus !== 'request_pending') {
      throw redirect({ to: '/' })
    }
  },
  component: CreateProfileComponent,
})

function CreateProfileComponent() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { profile, membershipStatus } = Route.useRouteContext()
  
  const [name, setName] = useState(profile?.display_name || '')
  const [address, setAddress] = useState(profile?.address || '')
  const [coords, setCoords] = useState<{lat:number, lng: number} | null>(null)
  const [isLocationVerified, setIsLocationVerified] = useState<boolean>(profile?.location_verified || false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  
  const [step, setStep] = useState<'name' | 'choice' | 'executing'>('name')
  const [method, setMethod] = useState<'join' | 'create' | null>(membershipStatus === 'request_pending' ? 'join' : null)
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

  const formatDate = (date: Date) => {
    return date.toISOString().slice(0,16);
  }

  const updateProfile = async () => {
    if (!name || !coords || !address) return
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('profiles')
      .update({ 
        display_name: name, 
        address: address, 
        location_verified: isLocationVerified, 
        location_verified_at: formatDate(new Date()) 
      })
      .eq('user_id', user?.id);
    if (error) throw error;

    if (!isLocationVerified) {
      setMethod('join')
    }
    setStep('choice')
  };

  const handleComplete = async (success = false) => {
    if (success) {
      setStep('executing')
      setError(null)

      sessionStorage.setItem('showNeighborhoodWelcome', 'true')
      
      await queryClient.invalidateQueries()
      await router.invalidate()
      window.location.replace('/')
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
          clearTimeout(verifyLocationTimer);
          setVerificationError(null);
        }
      },
      (error) => {
        console.log(error);
        navigator.geolocation.clearWatch(watchId);
        setIsVerifying(false);
        clearTimeout(verifyLocationTimer);
        setVerificationError("Location access denied. Please use manual verification with a neighbor." );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    const verifyLocationTimer = setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      setIsVerifying(false);
      setIsLocationVerified(false);
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
                onClick={() => updateProfile()}
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
            <div className="grid gap-5 text-left ">
              <div 
                onClick={() => setMethod('join')}
                className={`artisan-card transition-all text-center ${
                  method === 'join' ? 'border-brand-green' : 'border-transparent'
                }`}
              >
                <JoinNeighborhood onComplete={handleComplete} 
                coords={coords} 
                isLocationVerified={isLocationVerified} 
                method={method} 
                profileId={profile?.id} />
              </div>

              <div 
                onClick={() => setMethod('create')}
                className={`artisan-card transition-all text-center ${
                  method === 'create' ? 'border-brand-terracotta' : 'border-transparent'
                }`}
              >
                <CreateNeighborhood onComplete={handleComplete} coords={coords} isLocationVerified={isLocationVerified} method={method} />
              </div>
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