import { Home } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useState } from "react";

interface CreateNeighborhoodProps {
    coords: { lat: number; lng: number } | null
    isLocationVerified: boolean
    onComplete: (mode: string) => void
    method: string | null
}

export function CreateNeighborhood({ coords, isLocationVerified, onComplete, method }: CreateNeighborhoodProps) {
    const [neighborhoodName, setNeighborhoodName] = useState('')
    const [error, setError] = useState<string | null>(null)

    const handleCreate = async () => {
        if (!neighborhoodName || !coords) return
        setError(null)
        try {
          const { error: rpcError } = await supabase.rpc('initialize_neighborhood', {
            neighborhood_name: neighborhoodName.trim(),
            user_lat: coords.lat,
            user_lng: coords.lng
          })
          if (rpcError) {
            if (rpcError.message.includes('COLLISION')) {
              setError(rpcError.message.replace('COLLISION:', ''))
            } else {
              throw rpcError
            }
            onComplete(error || '')
            return
          }
          onComplete('create')
        } catch (err: any) {
          setError(err.message || 'Failed to create neighborhood')
        }
      }

      return (
        <div>
            {error && (
                <div className="alert-error mb-8 animate-in border-dashed">
                    <span className="alert-title mb-0">{error}</span>
                </div>
            )}
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
            {method === 'create' && <div className="mt-10">
              <button 
                disabled={!neighborhoodName || !isLocationVerified}
                className="btn-primary"
                onClick={() => handleCreate()}
              >
                Confirm Registration
              </button>
            </div>}
            
        </div>
      )

}
