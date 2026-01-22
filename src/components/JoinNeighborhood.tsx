import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Key } from "lucide-react";
import { PasscodeInput } from "./PasscodeInput";

export type JoinMode = 'withCode' | 'request'

interface JoinNeighborhoodProps {
    coords: { lat: number; lng: number } | null
    isLocationVerified: boolean
    onComplete: (mode: JoinMode) => void
    mode: JoinMode | null,
    method: string | null
}

export function JoinNeighborhood({ coords, isLocationVerified, onComplete, mode, method }: JoinNeighborhoodProps) {
    const [inviteCode, setInviteCode] = useState('')
    const [error, setError] = useState<string | null>(null)

    const handleJoin = async () => {
        if (!inviteCode || !coords) return
            setError(null)
        try {
          const { error: rpcError } = await supabase.rpc('join_neighborhood', {
            invite_code_text: inviteCode.trim(),
            user_lat: coords.lat,
            user_lng: coords.lng,
            locationverified: isLocationVerified
          })
          if (rpcError) throw rpcError

          onComplete(mode || 'withCode')
        } catch (err: any) {
          setError(err.message || 'Failed to join neighborhood')
        }
    }

    const handleRequest = async () => {
        console.log('Requesting');
        onComplete(mode || 'request')
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
              <div className="icon-box text-brand-green">
                  <Key className="w-4 h-4" />
              </div>
              <h3 className="artisan-card-title text-lg">Join Existing</h3>
              </div>
              <p className="leading-relaxed">Use an invite code provided by a neighbor. Or request one.</p>
              {(method === 'join' || method === 'request') && 
              <div className="mt-4 pt-4 border-t border-brand-stone animate-in zoom-in">
                  <label className="text-label block mb-4 text-center">Enter 6-Digit Invite Code</label>
                  <PasscodeInput 
                      value={inviteCode} 
                    onChange={setInviteCode}/>
              </div>}
              {(method === 'join' || method === 'request') && <div className="flex space-x-10 mt-10 justify-center">
                <button 
                  disabled={!inviteCode}
                  className="btn-secondary"
                  onClick={() => handleJoin()}
                >
                  Confirm Registration
                </button>
                <button 
                  disabled={!!inviteCode}
                  className="btn-tertiary hidden"
                  onClick={() => handleRequest()}
                >
                  Request an Invite Code
                </button>
                </div>}
            </div>
        </div>
    )
}