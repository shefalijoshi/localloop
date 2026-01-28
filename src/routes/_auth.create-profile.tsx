import { useState, useEffect } from 'react'
import { createFileRoute, useRouter, redirect } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { getCoordsFromAddress, getDistanceInMeters } from '../lib/geocoding'
import { User, MapPin, Dot, ChevronLeft, AlertTriangle } from 'lucide-react'
import { JoinNeighborhood } from '../components/JoinNeighborhood'
import { CreateNeighborhood } from '../components/CreateNeighborhood'

export const Route = createFileRoute('/_auth/create-profile')({
  beforeLoad: ({ context }) => {
    if (context.profile?.display_name && context.membershipStatus  && context.membershipStatus !== 'request_pending') {
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
  const [neighborhood, setNeighborhood] = useState<{id:string, name: string} | null>(null)
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
      setNeighborhood(null);
      return;
    }
    const controller = new AbortController();
    setIsGettingCoords(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const result = await getCoordsFromAddress(address, controller.signal);
        if (result) {
          setCoords({ lat: result.lat, lng: result.lng });
          const { data, error } = await supabase.rpc('find_nearest_neighborhood', {
            user_lat: result.lat,
            user_lng: result.lng
          });
  
          if (!error) setNeighborhood(data);
        } else {
          setCoords(null);
          setNeighborhood(null);
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
          navigator.geolocation.clearWatch(watchId);
          clearTimeout(verifyLocationTimer);

          setIsLocationVerified(true);
          setIsVerifying(false);
          setVerificationError(null);

          updateProfile();
          setStep('choice');

          if (neighborhood) {
            setMethod('join');
          } else {
            setMethod('create');
          }
        }
      },
      (error) => {
        console.log(error);
        navigator.geolocation.clearWatch(watchId);
        setIsVerifying(false);
        clearTimeout(verifyLocationTimer);
        setVerificationError("Couldn't verify your location." );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    const verifyLocationTimer = setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      setIsVerifying(false);
      setIsLocationVerified(false);
      setVerificationError("Couldn't verify your location.");
    }, 15000);
  };

  const continueUnverified = () => {
    setIsLocationVerified(false); 
    setVerificationError(null); 
    updateProfile(); 
    setStep('choice');
  }

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
              <h1 className="artisan-header-title">Set Up Your Profile</h1>
              <p className="artisan-header-description">
                Step 1 of 2: Help neighbors recognize you.
              </p>
            </header>

            <div className="artisan-card border-brand-green">
              <div className="space-y-2 text-left">
                
                {/* Name Input Group */}
                <div className="detail-row border-b-0 pb-0 items-start">
                  <div className="icon-box">
                    <User className="w-4 h-4 text-brand-green" />
                  </div>
                  <div className="flex-1">
                  <label className="text-label block mb-3 ml-1">How should neighbors know you?</label>
                  <input
                    className="artisan-input text-sm"
                    placeholder="e.g. Julianne Graham or Julie"
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
                    <label className="text-label block ml-1">Residential Address</label>   
                      <p className="artisan-meta-tiny italic mb-3">Only visible to verified neighbors within 0.5 miles</p>
                      <div className="input-adornment-wrapper">
                      <input
                        className={`artisan-input text-sm pr-12 transition-all duration-500 ${
                          coords ? 'border-brand-green/40 bg-brand-stone' : ''
                        }`}
                        placeholder="Enter your street address..."
                        value={address}
                        onChange={(e) => {setAddress(e.target.value); setVerificationError(null)}}
                      />
                    </div>
                  </div>
                </div>
                {
                  verificationError && 
                  <div className='flex items-center bg-local-yellow'>
                    <AlertTriangle className='w-4 h-4'></AlertTriangle>
                    <span className="alert-title mb-0 pl-2">{verificationError}</span>
                  </div>
                }
                { coords && <p className="mt-2 pl-8">
                  {neighborhood !== null ? `${verificationError !== null ? "No problem! A neighborhood exists here - just get 2 neighbors to vouch for you." : "Good news! There's already a neighborhood here. Verify your location for faster approval - only 1 neighbor needed."}`
                  : "You're the first one here! Location verification is required to create a new neighborhood."}</p>
                }
                { isVerifying &&
                  <div className='artisan-meta-tiny'><Dot className="animate-ping inline"/> Searching for GPS (Accuracy: {accuracy?.toFixed(0)} meters)</div>
                }
                { coords && (
                  <div className="mt-2 ml-8 text-center md:flex md:gap-4">
                    <button 
                    className="btn-primary"
                      type="button"
                      onClick={verifyWithWatch}
                      disabled={!address || !coords || isVerifying}
                    >
                      {verificationError !== null ? 'Try verification again': 'Verify and Continue'}
                    </button>
                    <button 
                    className="underline mt-4 md:hidden"
                      type="button"
                      onClick={ continueUnverified }
                      disabled={!address || !coords || isVerifying}
                    >Continue without verifying</button>
                    <button 
                    className="hidden md:block btn-tertiary"
                      type="button"
                      onClick={ continueUnverified }
                      disabled={!address || !coords || isVerifying}
                    >Continue without verifying</button>
                </div>
                )}
              </div>
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
              <h2 className="artisan-header-title text-2xl">{ method === 'create' ? "Establish a new neighborhood" : "Join a neighborhood"}</h2>
              <p className="artisan-header-description">Welcome, {name.split(' ')[0]}!</p>
            </header>
            <div className="grid gap-5 text-left ">
              <div 
                className={`artisan-card transition-all text-center ${
                  method === 'join' ? 'border-brand-green' : 'border-brand-terracotta'
                }`}
              >
                {method === 'create' && 
                  <JoinNeighborhood onComplete={handleComplete} 
                  coords={coords} 
                  isLocationVerified={isLocationVerified} 
                  profileId={profile?.id} 
                  />}
                {method === 'join' && 
                  <CreateNeighborhood 
                  onComplete={handleComplete} 
                  coords={coords} 
                  />}
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