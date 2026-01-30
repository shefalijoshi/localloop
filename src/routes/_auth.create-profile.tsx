import { useState } from 'react'
import { createFileRoute, useRouter, redirect } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getCoordsFromAddress, getDistanceInMeters } from '../lib/geocoding'
import { User, MapPin, ChevronLeft, AlertTriangle } from 'lucide-react'
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
  const [isLocationVerified, setIsLocationVerified] = useState<boolean>(profile?.location_verified || false)
  const [isGpsVerifying, setIsGpsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  
  const [step, setStep] = useState<'name' | 'choice' | 'executing'>(membershipStatus === 'request_pending' ? 'choice' : 'name')
  const [method, setMethod] = useState<'join' | 'create' | null>(membershipStatus === 'request_pending' ? 'join' : null)
  const [error, setError] = useState<string | null>(null)

  const { 
    data: geoData, 
    isFetching: isGeoLoading, 
    error: geoError 
  } = useQuery({
    queryKey: ['neighborhood-lookup', address],
    queryFn: async ({ signal }) => {
      const result = await getCoordsFromAddress(address, signal);
      if (!result) throw new Error("Could not find that address.");
  
      const { data, error: rpcError } = await supabase.rpc('find_nearest_neighborhood', {
        user_lat: result.lat,
        user_lng: result.lng,
        max_radius_miles: 0.5
      });
  
      if (rpcError) throw rpcError;
      
      return {
        coords: { lat: result.lat, lng: result.lng },
        neighborhood: data
      };
    },
    enabled: address.length >= 5,
    staleTime: 5000, 
    retry: false,
  });
  
  const coords = geoData?.coords || null;
  const neighborhood = geoData?.neighborhood || null;

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

    if (neighborhood) {
      setMethod('join')
    } else {
      setMethod('create')
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
    setIsGpsVerifying(true);
    setIsLocationVerified(false);

    const addressCoords: [number, number] = [coords.lng, coords.lat];
    let watchId: number;

    // Set a fallback timer to stop searching after 15s
    const verifyLocationTimer = setTimeout(() => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      setIsGpsVerifying(false);
      setVerificationError("Couldn't verify your location. GPS signal might be too weak.");
    }, 15000);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { longitude, latitude, accuracy } = position.coords;
        const userCoords: [number, number] = [longitude, latitude];
        setAccuracy(accuracy);

        const distance = getDistanceInMeters(userCoords, addressCoords);

        if (distance <= 100) {
          navigator.geolocation.clearWatch(watchId);
          clearTimeout(verifyLocationTimer);

          setIsLocationVerified(true);
          setIsGpsVerifying(false);
          setVerificationError(null);

          updateProfile();
        }
      },
      (err) => {
        navigator.geolocation.clearWatch(watchId);
        clearTimeout(verifyLocationTimer);
        setIsGpsVerifying(false);
        setVerificationError("Location access denied or GPS unavailable.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  };

  const activeError = geoError 
  ? "We couldn't locate that address. Have you entered it correctly?" 
  : verificationError;


  const continueUnverified = () => {
    setIsLocationVerified(false); 
    setVerificationError(null); 
    updateProfile(); 
  }

  return (
    <main className="flex-1 w-full mx-auto px-6 pt-6">
      <div className="artisan-page-focus">
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
                          disabled={isGpsVerifying}
                          onChange={(e) => {setAddress(e.target.value); setVerificationError(null)}}
                        />
                      </div>
                    </div>
                  </div>
                  {isGeoLoading && (
                    <div className="status-card-active animate-in">
                      <div className="spinner-brand h-4 w-4 border-2" />
                      <p className="text-sm font-bold">Validating address...</p>
                    </div>
                  )}
                  {activeError && (
                    <div className="status-card-warning animate-in">
                      <AlertTriangle className="w-5 h-5 text-brand-terracotta shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-label text-brand-terracotta/80 mb-1">Heads up</h4>
                        <p className="text-sm font-bold tracking-tight text-brand-dark leading-tight">
                          {activeError}
                        </p>
                      </div>
                    </div>
                  )}
                  {coords && (
                    <div className="text-explanation">
                      {neighborhood !== null 
                        ? (verificationError !== null 
                            ? "No problem! A neighborhood exists here—just get 2 neighbors to vouch for you." 
                            : "Good news! There's already a neighborhood here. Verify your location for faster approval.")
                        : (verificationError !== null 
                            ? "No problem! No neighborhood exists here yet. Verify your location to create one."
                            : "You're the first one here! Location verification is required to create a new neighborhood.")
                      }
                    </div>
                  )}
                  {isGpsVerifying && (
                    <div className="status-card-active animate-in">
                      <div className="gps-indicator">
                        <span className="gps-indicator-ping"></span>
                        <span className="gps-indicator-dot"></span>
                      </div>
                      <div className="flex-1">
                        <p className="text-label text-brand-green mb-1">GPS Active</p>
                        <p className="text-sm font-bold">
                          Matching with address... <span className="text-brand-muted">({accuracy?.toFixed(0)}m)</span>
                        </p>
                      </div>
                    </div>
                  )}
                  {coords && (
                    <div className="mt-8 flex flex-col md:flex-row gap-3">
                      <button 
                        className="btn-primary"
                        type="button"
                        onClick={verifyWithWatch}
                        disabled={!address || !coords || isGpsVerifying}
                      >
                        {verificationError !== null ? 'Try Verification Again' : 'Verify & Continue'}
                      </button>
                      
                      <button 
                        className={`btn-tertiary ${!neighborhood ? "hidden" : ""}`}
                        type="button"
                        onClick={continueUnverified}
                        disabled={!address || !coords || isGpsVerifying}
                      >
                        Continue without verifying
                      </button>
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
                className="nav-link-back text-label"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <header className="artisan-header">
                <h2 className="artisan-header-title">{ method === 'create' ? "Establish a new neighborhood" : "Join a neighborhood"}</h2>
                <p className="artisan-header-description">Welcome, {name.split(' ')[0]}!</p>
              </header>
              <div className={`artisan-card ${method === 'join' ? 'border-brand-green' : 'border-brand-terracotta'}`}>
                {method === 'create' ? (
                  <CreateNeighborhood 
                  onComplete={handleComplete} 
                  coords={coords} 
                  />
                ) : (
                  <JoinNeighborhood 
                    onComplete={handleComplete} 
                    coords={coords} 
                    isLocationVerified={isLocationVerified} 
                    profileId={profile?.id} 
                  />
                )}
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
    </main>  
  )
}