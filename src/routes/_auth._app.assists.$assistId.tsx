import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { 
  ChevronLeft, 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  ShieldCheck, 
  Play, 
  CheckCircle2,
  Brain,
  BadgeAlert,
  NotebookText,
  Calendar
} from 'lucide-react'
import { addMinutes, format, formatDuration, intervalToDuration } from 'date-fns'
import { CATEGORY_INTENT } from '../lib/categoryIntent'

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
      const {name, size, temperament, special_needs} = data.snapshot_data;
      const dataWithHelperProfile = {
        ...data,
        display_name: name,
        size,
        temperament,
        special_needs
      }
      return dataWithHelperProfile
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

  const category = CATEGORY_INTENT.find(c => c.id === assist.category_id);
  const action = category?.actions.find(a => a.id === assist.action_id);

  const actionLabel = action?.label || '';

  let heading = assist?.display_name || '';
  if (actionLabel) {
    heading = heading ? `${heading} - ${actionLabel}` : `${actionLabel}`;
  }

  const startTime = new Date(assist.scheduled_time);
  const endTime = addMinutes(startTime, assist.expected_duration || 0);

  const isCustomRequest = assist.action_id === 'custom_service' || assist.action_id === 'custom_item'

  return (
    <div className="artisan-page-focus">
      <div className="artisan-container-large">
        {/* Navigation */}
        <button 
          onClick={() => navigate({ to: '/dashboard' })}
          className="nav-link-back"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        {/* Hero Header */}
        <header className="artisan-header">
          <h2 className="artisan-header-title">{heading}</h2>
          <p className="artisan-meta-tiny !text-brand-muted tracking-widest">
            {category?.label}
          </p>
          {isCustomRequest && assist.details && !actionLabel && (
            <q className="text-brand-text mt-1">
              {assist.details}
            </q>
          )}
        </header>

        <div className="space-y-4">
          {/* Verification Card */}
          <div className="artisan-card p-2 bg-white border-t-4 border-brand-terracotta text-center">
            <div className="flex justify-center mb-3">
              <ShieldCheck className="w-6 h-6 text-brand-terracotta" />
            </div>
            <span className="capitalize">
              {assist.status.replace('_', ' ')}{isHelper ? ` with ${assist.seeker_name}` : ` with ${assist.helper_name}`}
            </span>
            <div className="text-4xl font-serif tracking-[0.3em] text-brand-dark ml-[0.3em]">
              {assist.verification_code}
            </div>
            <p className="text-label">Exchange this code when meeting to verify identity</p>
          </div>

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
                  {updateStatusMutation.isPending ? 'STARTING...' : 'START'}
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

          <div className="artisan-card mb2">
            <div className="artisan-card-inner">
            {!isCustomRequest && assist.details && (
              <div className="detail-row">
                <div className="icon-box">
                  <NotebookText className="w-4 h-4 text-brand-green" />
                </div>
                <div>
                  <p className="text-label block mb-3">Extra Details</p>
                  <q className="text-brand-dark font-medium">
                    {assist.details}
                  </q>
              </div>
            </div>)}
              <div className="detail-row">
                <div className="icon-box">
                  <Calendar className="w-4 h-4 text-brand-green" />
                </div>
                {assist.request_type === 'item' && (
                  <div>
                    <p className="text-label block mb-3">Pick up and return</p>
                    <p className="text-brand-dark font-medium">
                    {format(startTime, 'MMM d')} - {format(endTime, 'MMM d')}
                    </p>
                  </div>)
                }
                {assist.request_type === 'service' && (
                  <div>
                    <p className="text-label block mb-3">Starting</p>
                    <p className="text-brand-dark font-medium">
                    {format(startTime, 'MMM d HH:mm a')}
                    </p>
                  </div>)
                }
              </div>
              {/* 2. Duration Section */}
              <div className="detail-row">
                <div className="icon-box">
                  <Clock className="w-4 h-4 text-brand-green" />
                </div>
                <div>
                  <p className="text-label block mb-3">Estimated Time</p>
                  <p className="text-brand-dark font-medium">{formatDuration(intervalToDuration({start: 0, end: assist.expected_duration * 60 * 1000}), { delimiter: ', ' })}</p>
                </div>
              </div>
              {/* 3. Location Section */}
              <div className="detail-row">
                <div className="icon-box">
                  <MapPin className="w-4 h-4 text-brand-green" />
                </div>
                <div>
                  <p className="text-label block mb-3">Address (Verified)</p>
                  <p className="text-brand-dark font-medium">
                    {assist.seeker_address}
                  </p>
                  <p className="artisan-meta-tiny mt-2">Full address shared once accepted</p>
                </div>
              </div>
              {/* Contact information */}
              {isHelper && assist.seeker_email && (
                  <div className="detail-row">
                  <div className="icon-box">
                    <Mail className="w-4 h-4 text-brand-green/60" />
                  </div>
                  <div>
                    <p className="text-label block mb-3">Email</p>
                    <p className="text-brand-dark font-medium">{assist.seeker_email}</p>
                  </div>
                </div>
              )}
              {!isHelper && assist.helper_phone && (
                <div className="detail-row">
                  <div className="icon-box">
                    <Phone className="w-4 h-4 text-brand-green/60" />
                  </div>
                  <div>
                    <p className="text-label block mb-3">Phone</p>
                    <p className="text-brand-dark font-medium">{assist.helper_phone}</p>
                  </div>
                </div>)}
              {!isHelper && assist.helper_email && (
                <div className="detail-row">
                  <div className="icon-box">
                    <Mail className="w-4 h-4 text-brand-green/60" />
                  </div>
                  <div>
                    <p className="text-label block mb-3">Email</p>
                    <p className="text-brand-dark font-medium">{assist.helper_email}</p>
                  </div>
                </div>)}  
            </div>
          </div>

          {/* Personality Card */}
          {(assist.temperament?.length > 0) && (
            <div className="artisan-card mb-2">
            <div className="artisan-card-inner">
              <div className="detail-row">
                <div className="icon-box">
                  <Brain className="w-4 h-4 text-brand-green" />
                </div>
                <div>
                  <p className="text-label block mb-3">Temperament</p>
                  <div className="text-brand-dark font-medium">
                    {assist.temperament.map((trait: string) => (
                      <span key={trait} className="badge-pill">
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Special Needs Card */}
          {(assist.temperament?.length > 0) &&
          (<div className="artisan-card">
            <div className="artisan-card-inner">
              <div className="detail-row">
                <div className="icon-box">
                  <BadgeAlert className="w-4 h-4 text-brand-terracotta" />
                </div>
                <div>
                  <p className="text-label block mb-3">Care Instructions</p>
                  <p className="text-brand-dark font-medium">
                    "{assist.special_needs}"
                  </p>
                </div>
              </div>
            </div>
          </div>)}
        </div>
      </div>
    </div>
  )
}