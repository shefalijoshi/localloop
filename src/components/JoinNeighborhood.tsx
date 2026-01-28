import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Key } from "lucide-react";
import { PasscodeInput } from "./PasscodeInput";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorMessages, type ErrorCode } from "../lib/errorCodes";

interface JoinNeighborhoodProps {
    coords: { lat: number; lng: number } | null
    isLocationVerified: boolean
    onComplete: (success: boolean) => void
    profileId: string
}

export function JoinNeighborhood({ coords, isLocationVerified, onComplete, profileId }: JoinNeighborhoodProps) {
    const [inviteCode, setInviteCode] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [supportContacted, setSupportContacted] = useState(false)
    const queryClient = useQueryClient()

    const { data: membership, isLoading } = useQuery({
      queryKey: ['my-membership'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('neighborhood_memberships')
          .select('id, invited_at')
          .eq('profile_id', profileId)
          .eq('status', 'request_pending')
          .maybeSingle()
  
        if (error) throw error
        return data
      },
    })
    
    const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null)
    
    useEffect(() => {
      if (!membership?.invited_at) return
      const expiry = new Date(membership.invited_at).getTime()
      
      const updateTimer = () => {
        const now = Date.now()
        const diff = 1440 - Math.round((now - expiry) / 60000);
        setMinutesRemaining(diff)
      }
  
      updateTimer()
      const interval = setInterval(updateTimer, 30000)
      return () => clearInterval(interval)
    }, [membership?.invited_at])

    const handleJoin = useMutation({
      mutationFn: async () => {
        if (!inviteCode || !coords) return
            setError(null)
        const { error: rpcError } = await supabase.rpc('join_neighborhood', {
          invite_code_text: inviteCode.trim(),
          user_lat: coords.lat,
          user_lng: coords.lng,
          locationverified: isLocationVerified
        })
        if (rpcError) throw rpcError
      },
      onSuccess: async () => {
        onComplete(true)
      },
      onError: () => setError('Failed to join neighborhood')
    })

    const handleRequest = useMutation({
      mutationFn: async () => {
        if (!coords) throw new Error("Location not found")
        setError(null)
        const { data: response, error: rpcError } = await supabase.rpc('find_and_request_join', {
          user_lat: coords.lat,
          user_lng: coords.lng
        })
        if (rpcError) throw rpcError
        return response
      },
      onSuccess: async (response:any) => {
        if (response.success === false) {
          setError(ErrorMessages[response.error as ErrorCode] || 'Unable to complete your request to join neighborhood');
        }
        await queryClient.invalidateQueries({queryKey: ['my-membership']})
        onComplete(false)
      },
      onError: () => {
        //Special handling for - PENDING_REQUEST, NO_NEIGHBORHOOD_FOUND
        setError('Failed request to join neighborhood')
      }
    })

    const handleContactSupport = useMutation({
      mutationFn: async () => {
        if (!coords) throw new Error("Location not found")
        setError(null)
        const { data: response, error: rpcError } = await supabase.rpc('create_support_request', {
          profile_id: profileId,
          neighorhood_membership_id: membership?.id || null,
        })
        if (rpcError) throw rpcError
        return response
      },
      onSuccess: async () => {
        setSupportContacted(true);
        onComplete(false)
      },
      onError: () => {
        setSupportContacted(false);
        setError('Failed to contact support.')
      }
    })

    const contactSupport = !isLoading && minutesRemaining !== null && minutesRemaining <= 0

    return (
        <div className="space-y-3">
            {error && (
                <div className="alert-error mb-8 animate-in border-dashed">
                    <span className="alert-title mb-0">{error}</span>
                </div>
            )}
            {membership !== null &&
              (!contactSupport ? <p className="my-4 border-2 border-dashed alert-info leading-relaxed">Your request to join the neighborhood is being reviewed.</p>
                : !supportContacted ? <p className="my-4 border-2 border-dashed alert-info leading-relaxed">Can't wait to be part of the neighborhood any longer? Contact support to proceed.</p> : <p className="leading-relaxed">Your support request has been submitted. Someone will get back to you soon.</p>
              )
            }
            <div className="p-1 pb-6 border-b border-brand-green">
              <div className="flex items-center justify-center gap-4 mb-3">
                <Key className="w-4 h-4" />
                <p className="leading-relaxed">Use an invite code from a neighbor.</p>
              </div>
              <div className="mt-4 pt-4 border-t border-brand-stone animate-in zoom-in">
                  <label className="text-label block mb-4 text-center">Enter 6-Digit Invite Code</label>
                  <PasscodeInput 
                      value={inviteCode} 
                    onChange={setInviteCode}/>
              </div>
              <div className="flex space-x-10 mt-6 justify-center">
                <button 
                  disabled={!inviteCode || handleJoin.isPending}
                  className="btn-primary"
                  onClick={() => handleJoin.mutate()}
                >
                  Submit Code
                </button>
              </div>
            </div>
            <div className="p-1">
              <div className="flex items-center gap-4 mb-3">
                <p className="leading-relaxed text-brand-muted">Don't have a code? Request to join and a neighbor will approve you.</p>
              </div>
             
              <div className="flex space-x-10 mt-6 justify-center">
                {contactSupport ? <button 
                  disabled={handleContactSupport.isPending || supportContacted}
                  className="btn-tertiary"
                  onClick={() => handleContactSupport.mutate()}
                >
                  Contact support
                </button> :
                <button 
                  disabled={!!inviteCode || handleRequest.isPending || membership !== null}
                  className="btn-tertiary"
                  onClick={() => handleRequest.mutate()}
                >
                  Request to join
                </button>
                }
              </div>
            </div>
        </div>
    )
}