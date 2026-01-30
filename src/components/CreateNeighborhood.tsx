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
    },
    onSuccess: () => {
      onComplete(true)
    },
    onError: (rpcError: any) => {
      if (rpcError.message?.includes('COLLISION')) {
        setError(rpcError.message.replace('COLLISION:', ''))
      } else {
        setError(rpcError.message || 'Failed to create neighborhood')
      }
      onComplete(false)
    }
  })

  return (
    <div className="space-y-6">
        {error && (
          <div className="status-card-warning animate-in">
            <p className="text-sm font-bold leading-tight">{error}</p>
          </div>
        )}

        <div className="text-left space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-brand-terracotta/10 rounded-2xl flex items-center justify-center shrink-0">
                <Home className="w-6 h-6 text-brand-terracotta" />
              </div>
              <div>
                <p className="text-sm font-bold text-brand-dark">Founder Mode</p>
                <p className="text-xs text-brand-muted font-medium">You're the first resident in this area to register.</p>
              </div>
            </div>

            <div className="p-4 bg-brand-stone/30 rounded-2xl border border-brand-stone/50">
              <p className="text-xs leading-relaxed text-brand-dark/70 font-medium">
                You'll be able to invite and approve neighbors. Establish the name they'll see when they join.
              </p>
            </div>
            
            <div className="pt-2 animate-in slide-in-from-bottom-2 duration-500">
                <label className="text-[10px] uppercase tracking-widest font-black text-brand-muted mb-2 block ml-1">
                  Neighborhood Name
                </label>
                <input
                  className="artisan-input text-base placeholder:text-brand-muted/50"
                  placeholder="e.g. Oak St"
                  value={neighborhoodName}
                  onChange={(e) => setNeighborhoodName(e.target.value)}
                />
            </div>
        </div>

        <div className="pt-4">
          <button 
            disabled={!neighborhoodName || handleCreate.isPending}
            className="btn-secondary w-full py-4 text-base transition-all active:scale-95"
            onClick={() => handleCreate.mutate()}
          >
            {handleCreate.isPending ? "Establishing..." : "Create Neighborhood"}
          </button>
        </div>
    </div>
  )
}
