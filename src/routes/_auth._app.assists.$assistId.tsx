import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { 
  ChevronLeft, 
  MapPin, 
  Phone, 
  Mail, 
  Dog, 
  Clock, 
  ShieldCheck, 
  Play, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { format } from 'date-fns'

export const Route = createFileRoute('/_auth/_app/assists/$assistId')({
  component: AssistDetailComponent,
})

function AssistDetailComponent() {
  const { assistId } = Route.useParams()
  const { profile } = Route.useRouteContext()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: assist, isLoading } = useQuery({
    queryKey: ['assist_details', assistId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_assist_details', { 
        t_assist_id: assistId 
      })
      if (error) throw error
      return data
    }
  })

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase.rpc('update_assist_status', {
        t_assist_id: assistId,
        t_new_status: newStatus
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assist_details', assistId] })
      queryClient.invalidateQueries({ queryKey: ['neighborhood_feed'] })
    }
  })

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-[#F9F7F2]"><div className="h-8 w-8 border-4 border-[#4A5D4E] border-t-transparent rounded-full animate-spin" /></div>
  if (!assist) return <div className="p-8 text-center font-serif italic text-[#6B6658]">Assist not found.</div>

  const isHelper = assist.helper_id === profile?.id
  const status = assist.status

  return (
    <div className="min-h-screen bg-[#F9F7F2] pb-20">
      <div className="px-6 pt-8 max-w-md mx-auto">
        {/* Navigation - Matches Request Details */}
        <button 
          onClick={() => navigate({ to: '/dashboard' })}
          className="flex items-center gap-2 text-[#A09B8E] hover:text-[#4A5D4E] transition-colors mb-6"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-widest font-bold">Back to Feed</span>
        </button>

        {/* Hero Header - Matches Request Details style */}
        <header className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <div className="h-24 w-24 bg-white rounded-full shadow-md flex items-center justify-center overflow-hidden border-4 border-white mx-auto">
              {assist.dog_photo ? (
                <img src={assist.dog_photo} alt={assist.dog_name} className="h-full w-full object-cover" />
              ) : (
                <Dog className="w-10 h-10 text-[#EBE7DE]" />
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1.5 shadow-sm border border-[#F2F0E9]">
                <div className={`w-3 h-3 rounded-full ${status === 'in_progress' ? 'bg-orange-500' : 'bg-[#4A5D4E]'}`} />
            </div>
          </div>
          <h1 className="text-3xl font-serif text-[#2D2D2D] mb-1">
            {isHelper ? `Walk for ${assist.seeker_name}` : `Walk by ${assist.helper_name}`}
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#A09B8E]">
            {assist.dog_name} • {status.replace('_', ' ')}
          </p>
        </header>

        <div className="space-y-4">
          {/* Verification Card - Styled as a primary emphasis card */}
          <div className="artisan-card p-6 bg-white border-t-4 border-[#BC6C4D] text-center shadow-sm">
            <div className="flex justify-center mb-3">
              <ShieldCheck className="w-6 h-6 text-[#BC6C4D]" />
            </div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#A09B8E] mb-2">Verification Code</p>
            <div className="text-4xl font-serif tracking-[0.3em] text-[#2D2D2D] ml-[0.3em]">
              {assist.verification_code}
            </div>
            <p className="text-[9px] text-[#A09B8E] mt-4 italic">Exchange this code when meeting to verify identity</p>
          </div>

          <div className="artisan-card p-6 bg-white shadow-sm space-y-6">
            
            {/* 1. Timeframe Section (Added) */}
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-[#F2F0E9]/50 rounded-full flex items-center justify-center shadow-sm border border-[#EBE7DE] shrink-0">
                <Clock className="w-5 h-5 text-[#4A5D4E]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] uppercase tracking-widest font-bold text-[#A09B8E]">Timeframe</p>
                <p className="text-sm text-[#2D2D2D] font-medium">
                  {assist.timeframe ? format(new Date(assist.timeframe), 'p') : 'As Soon As Possible'}
                </p>
              </div>
            </div>

            {/* 2. Duration Section */}
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-[#F2F0E9]/50 rounded-full flex items-center justify-center shadow-sm border border-[#EBE7DE] shrink-0">
                <Dog className="w-5 h-5 text-[#4A5D4E]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] uppercase tracking-widest font-bold text-[#A09B8E]">Planned Duration</p>
                <p className="text-sm text-[#2D2D2D] font-medium">{assist.duration} Minutes</p>
              </div>
            </div>

            {/* 3. Verified Address Section */}
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-[#F2F0E9]/50 rounded-full flex items-center justify-center shadow-sm border border-[#EBE7DE] shrink-0">
                <MapPin className="w-5 h-5 text-[#4A5D4E]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] uppercase tracking-widest font-bold text-[#A09B8E]">Pickup Address (Verified)</p>
                <p className="text-sm text-[#2D2D2D] font-medium leading-relaxed">
                  {isHelper ? assist.seeker_full_address : assist.seeker_street_name}
                </p>
              </div>
            </div>

            {/* 4. Contact Information Section */}
            <div className="pt-6 border-t border-[#F2F0E9] space-y-4">
              <p className="text-[9px] uppercase tracking-widest font-bold text-[#A09B8E]">Primary Contact</p>
              
              {isHelper ? (
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-[#F9F7F2] rounded-full flex items-center justify-center border border-[#EBE7DE] shrink-0">
                    <Mail className="w-4 h-4 text-[#4A5D4E]/60" />
                  </div>
                  <p className="text-sm text-[#2D2D2D] font-medium truncate">{assist.seeker_email}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assist.helper_phone && (
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-[#F9F7F2] rounded-full flex items-center justify-center border border-[#EBE7DE] shrink-0">
                        <Phone className="w-4 h-4 text-[#4A5D4E]/60" />
                      </div>
                      <p className="text-sm text-[#2D2D2D] font-medium">{assist.helper_phone}</p>
                    </div>
                  )}
                  {assist.helper_email && (
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-[#F9F7F2] rounded-full flex items-center justify-center border border-[#EBE7DE] shrink-0">
                        <Mail className="w-4 h-4 text-[#4A5D4E]/60" />
                      </div>
                      <p className="text-sm text-[#2D2D2D] font-medium truncate">{assist.helper_email}</p>
                    </div>
                  )}
                  {!assist.helper_phone && !assist.helper_email && (
                    <p className="text-[10px] italic text-[#A09B8E] text-center bg-[#F9F7F2] py-3 rounded-xl">
                      Contact details not shared
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Personality Card - Matches Request Details */}
          {(assist.temperament?.length > 0) && (
            <div className="artisan-card p-6 bg-white">
              <p className="text-[10px] uppercase tracking-widest font-bold text-[#A09B8E] mb-3">Temperament</p>
              <div className="flex flex-wrap gap-2">
                {assist.temperament.map((trait: string) => (
                  <span key={trait} className="px-3 py-1 bg-[#F9F7F2] border border-[#EBE7DE] rounded-full text-[10px] font-bold uppercase text-[#6B6658]">
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Special Needs Card - Matches Request Details */}
          {assist.special_needs && (
            <div className="artisan-card p-6 bg-white border-l-4 border-[#BC6C4D]/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-3 h-3 text-[#BC6C4D]" />
                <p className="text-[10px] uppercase tracking-widest font-bold text-[#BC6C4D]">Care Instructions</p>
              </div>
              <p className="text-sm text-[#6B6658] leading-relaxed italic">
                "{assist.special_needs}"
              </p>
            </div>
          )}

          {/* Action Area - Not floating, matches Request Details button area */}
          {isHelper && status !== 'completed' && (
            <div className="mt-8">
              {status === 'confirmed' ? (
                <button 
                  onClick={() => updateStatusMutation.mutate('in_progress')}
                  disabled={updateStatusMutation.isPending}
                  className="btn-primary w-full shadow-xl shadow-[#4A5D4E]/10 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {updateStatusMutation.isPending ? 'STARTING...' : 'START WALK'}
                </button>
              ) : (
                <button 
                  onClick={() => updateStatusMutation.mutate('completed')}
                  disabled={updateStatusMutation.isPending}
                  className="btn-primary w-full bg-[#BC6C4D] border-[#BC6C4D] shadow-xl shadow-[#BC6C4D]/10 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {updateStatusMutation.isPending ? 'COMPLETING...' : 'COMPLETE WALK'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}