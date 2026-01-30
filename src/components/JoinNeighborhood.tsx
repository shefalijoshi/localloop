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
  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null)
  const queryClient = useQueryClient()

  const { data: membership, isLoading } = useQuery({
    queryKey: ['my-membership', profileId],
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
    onSuccess: () => onComplete(true),
    onError: () => setError('Failed to join neighborhood')
  })

  const handleRequest = useMutation({
    mutationFn: async () => {
      if (!coords) throw new Error("Location not found")
      setError(null)
      const { data, error: rpcError } = await supabase.rpc('find_and_request_join', {
        user_lat: coords.lat,
        user_lng: coords.lng
      })
      if (rpcError) throw rpcError
      return data
    },
    onSuccess: async (response:any) => {
      if (response.success === false) {
        setError(ErrorMessages[response.error as ErrorCode] || 'Unable to complete your request to join neighborhood');
      }
      await queryClient.invalidateQueries({queryKey: ['my-membership']})
      onComplete(false)
    },
    onError: () => setError('Failed request to join neighborhood')
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
    onSuccess: () => {
      setSupportContacted(true);
      onComplete(false);
    },
    onError: () => {
      setSupportContacted(false);
      setError('Failed to contact support.')
    }
  })

  const contactSupport = !isLoading && minutesRemaining !== null && minutesRemaining <= 0

  return (
      <div className="space-y-6">
          {(membership !== null || error || supportContacted) && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
              {error && (
                <div className="status-card-warning">
                  <p className="text-sm font-bold">{error}</p>
                </div>
              )}
              
              {membership !== null && (
                <div className="status-card-active">
                  <p className="text-sm font-bold leading-relaxed">
                    {!contactSupport 
                      ? "Your request to join the neighborhood is being reviewed." 
                      : !supportContacted 
                        ? "Can't wait to be part of the neighborhood any longer? Contact support to proceed." 
                        : "Your support request has been submitted. Someone will get back to you soon."}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="text-center py-4 border-b border-brand-stone/50">
            <div className="flex flex-col items-center gap-2 mb-6">
              <div className="h-10 w-10 bg-brand-green/10 rounded-full flex items-center justify-center">
                <Key className="w-5 h-5 text-brand-green" />
              </div>
              <p className="text-sm font-medium text-brand-muted leading-relaxed">Use an invite code from a neighbor.</p>
            </div>
            
            <PasscodeInput value={inviteCode} onChange={setInviteCode}/>
            
            <button 
              disabled={!inviteCode || handleJoin.isPending}
              className="btn-primary mt-6 w-full max-w-[200px] mx-auto"
              onClick={() => handleJoin.mutate()}
            >
              {handleJoin.isPending ? "Joining..." : "Submit Code"}
            </button>
          </div>

          <div className="text-center pt-2">
            <p className="text-xs text-brand-muted mb-4 px-4 leading-relaxed">
              Don't have a code? Request to join and a neighbor will approve you.
            </p>
            
            {contactSupport ? (
              <button 
                disabled={handleContactSupport.isPending || supportContacted}
                className="btn-tertiary"
                onClick={() => handleContactSupport.mutate()}
              >
                {handleContactSupport.isPending ? "Connecting..." : supportContacted ? "Request Sent" : "Contact support"}
              </button>
            ) : (
              <button 
                disabled={!!inviteCode || handleRequest.isPending || membership !== null}
                className="btn-tertiary"
                onClick={() => handleRequest.mutate()}
              >
                {handleRequest.isPending ? "Sending..." : "Request to join"}
              </button>
            )}
          </div>
      </div>
  )
}