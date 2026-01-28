import { Home } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

interface CreateNeighborhoodProps {
    coords: { lat: number; lng: number } | null
    onComplete: (success: boolean) => void
}

export function CreateNeighborhood({ coords, onComplete }: CreateNeighborhoodProps) {
    const [neighborhoodName, setNeighborhoodName] = useState('')
    const [error, setError] = useState<string | null>(null)

    const handleCreate = useMutation({
      mutationFn: async () => {
        if (!neighborhoodName || !coords) return
        setError(null)
        const { error: rpcError } = await supabase.rpc('initialize_neighborhood', {
          neighborhood_name: neighborhoodName.trim(),
          user_lat: coords.lat,
          user_lng: coords.lng
        })
        if (rpcError) throw rpcError
      }
      ,
      onSuccess: () => {
        onComplete(true)
      },
      onError: (rpcError: any) => {
        if (rpcError.message.includes('COLLISION')) {
          setError(rpcError.message.replace('COLLISION:', ''))
        } else {
          setError(rpcError.message || 'Failed to create neighborhood')
        }
        onComplete(false)
      }
    })

    return (
      <div>
          {error && (
              <div className="alert-error mb-8 animate-in border-dashed">
                  <span className="alert-title mb-0">{error}</span>
              </div>
          )}
          <div className="p-1">
              <div className="flex items-center gap-2 mb-3">
                <Home className="w-6 h-6" />
                <p className="leading-relaxed text-left">You are the first resident in this area to register.</p>
              </div>
              <p className="leading-relaxed text-left">You'll be able to invite and approve neighbors.</p>
              
              <div className="mt-4 pt-4 border-t border-brand-terracotta/10 animate-in zoom-in">
                  <input
                  className="artisan-input text-sm"
                  placeholder="Neighborhood Name (e.g. Oak St)"
                  value={neighborhoodName}
                  onChange={(e) => setNeighborhoodName(e.target.value)}
                  />
              </div>
          </div>
          <div className="mt-10">
            <button 
              disabled={!neighborhoodName}
              className="btn-secondary"
              onClick={() => handleCreate.mutate()}
            >
              Create Neighborhood
            </button>
          </div>
          
      </div>
    )
}
