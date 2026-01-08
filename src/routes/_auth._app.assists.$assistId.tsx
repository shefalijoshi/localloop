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

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-brand-beige"><div className="h-8 w-8 border-4 border-brand-green border-t-transparent rounded-full animate-spin" /></div>
  if (!assist) return <div className="p-8 text-center font-serif italic text-brand-text">Assist not found.</div>

  const isHelper = assist.helper_id === profile?.id
  const status = assist.status

  return (
    <div className="min-h-screen bg-brand-beige pb-20">
      <div className="px-6 pt-8 max-w-md mx-auto">
        {/* Navigation */}
        <button 
          onClick={() => navigate({ to: '/dashboard' })}
          className="flex items-center gap-2 text-brand-muted hover:text-brand-green transition-colors mb-6 group"
        >
          <ChevronLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          <span className="text-label">Back to Feed</span>
        </button>

        {/* Hero Header */}
        <header className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <div className="h-24 w-24 bg-white rounded-full shadow-md flex items-center justify-center overflow-hidden border-4 border-white mx-auto">
              {assist.dog_photo ? (
                <img src={assist.dog_photo} alt={assist.dog_name} className="h-full w-full object-cover" />
              ) : (
                <Dog className="w-10 h-10 text-brand-stone" />
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1.5 shadow-sm border border-brand-border">
                <div className={`w-3 h-3 rounded-full ${status === 'in_progress' ? 'bg-orange-500' : 'bg-brand-green'}`} />
            </div>
          </div>
          <h1 className="text-3xl font-serif text-brand-dark mb-1">
            {isHelper ? `Walk for ${assist.seeker_name}` : `Walk by ${assist.helper_name}`}
          </h1>
          <p className="text-label text-brand-muted">
            {assist.dog_name} • {status.replace('_', ' ')}
          </p>
        </header>

        <div className="space-y-4">
          {/* Verification Card */}
          <div className="artisan-card p-6 bg-white border-t-4 border-brand-terracotta text-center">
            <div className="flex justify-center mb-3">
              <ShieldCheck className="w-6 h-6 text-brand-terracotta" />
            </div>
            <p className="text-label mb-2">Verification Code</p>
            <div className="text-4xl font-serif tracking-[0.3em] text-brand-dark ml-[0.3em]">
              {assist.verification_code}
            </div>
            <p className="text-[9px] text-brand-muted mt-4 italic">Exchange this code when meeting to verify identity</p>
          </div>

          <div className="artisan-card p-6 bg-white space-y-6">
            
            {/* Timeframe Section */}
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-brand-stone/50 rounded-full flex items-center justify-center shadow-sm border border-brand-border shrink-0">
                <Clock className="w-5 h-5 text-brand-green" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-label">Timeframe</p>
                <p className="text-sm text-brand-dark font-medium">
                  {assist.timeframe ? format(new Date(assist.timeframe), 'p') : 'As Soon As Possible'}
                </p>
              </div>
            </div>

            {/* Duration Section */}
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-brand-stone/50 rounded-full flex items-center justify-center shadow-sm border border-brand-border shrink-0">
                <Dog className="w-5 h-5 text-brand-green" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-label">Planned Duration</p>
                <p className="text-sm text-brand-dark font-medium">{assist.duration} Minutes</p>
              </div>
            </div>

            {/* Verified Address Section */}
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-brand-stone/50 rounded-full flex items-center justify-center shadow-sm border border-brand-border shrink-0">
                <MapPin className="w-5 h-5 text-brand-green" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-label">Pickup Address (Verified)</p>
                <p className="text-sm text-brand-dark font-medium leading-relaxed">
                  {isHelper ? assist.seeker_full_address : assist.seeker_street_name}
                </p>
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="pt-6 border-t border-brand-stone space-y-4">
              <p className="text-label">Primary Contact</p>
              
              {isHelper ? (
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-brand-beige rounded-full flex items-center justify-center border border-brand-border shrink-0">
                    <Mail className="w-4 h-4 text-brand-green/60" />
                  </div>
                  <p className="text-sm text-brand-dark font-medium truncate">{assist.seeker_email}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assist.helper_phone && (
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-brand-beige rounded-full flex items-center justify-center border border-brand-border shrink-0">
                        <Phone className="w-4 h-4 text-brand-green/60" />
                      </div>
                      <p className="text-sm text-brand-dark font-medium">{assist.helper_phone}</p>
                    </div>
                  )}
                  {assist.helper_email && (
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-brand-beige rounded-full flex items-center justify-center border border-brand-border shrink-0">
                        <Mail className="w-4 h-4 text-brand-green/60" />
                      </div>
                      <p className="text-sm text-brand-dark font-medium truncate">{assist.helper_email}</p>
                    </div>
                  )}
                  {!assist.helper_phone && !assist.helper_email && (
                    <p className="text-[10px] italic text-brand-muted text-center bg-brand-beige py-3 rounded-xl">
                      Contact details not shared
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Personality Card */}
          {(assist.temperament?.length > 0) && (
            <div className="artisan-card p-6 bg-white">
              <p className="text-label mb-3">Temperament</p>
              <div className="flex flex-wrap gap-2">
                {assist.temperament.map((trait: string) => (
                  <span key={trait} className="px-3 py-1 bg-brand-beige border border-brand-border rounded-full text-[10px] uppercase text-brand-text">
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Special Needs Card */}
          {assist.special_needs && (
            <div className="artisan-card p-6 bg-white border-l-4 border-brand-terracotta/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-3 h-3 text-brand-terracotta" />
                <p className="text-label text-brand-terracotta">Care Instructions</p>
              </div>
              <p className="text-sm text-brand-text leading-relaxed italic">
                "{assist.special_needs}"
              </p>
            </div>
          )}

          {/* Action Area */}
          {isHelper && status !== 'completed' && (
            <div className="mt-8">
              {status === 'confirmed' ? (
                <button 
                  onClick={() => updateStatusMutation.mutate('in_progress')}
                  disabled={updateStatusMutation.isPending}
                  className="btn-primary"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {updateStatusMutation.isPending ? 'STARTING...' : 'START WALK'}
                </button>
              ) : (
                <button 
                  onClick={() => updateStatusMutation.mutate('completed')}
                  disabled={updateStatusMutation.isPending}
                  className="btn-secondary"
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