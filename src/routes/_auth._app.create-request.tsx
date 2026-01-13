import { useContext, useState } from 'react';
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { CategoryGrid } from '../components/CategoryGrid';
import { ActionSelector } from '../components/ActionSelector';
import { PetPicker } from '../components/PetPicker';
import { ServiceDurationField } from '../components/ServiceDurationField';
import { ItemDurationField } from '../components/ItemDurationField';
import type { Category, Action } from '../lib/categoryIntent';
import { CATEGORY_INTENT } from '../lib/categoryIntent';
import { ChevronLeft, Send, Loader2 } from 'lucide-react';

type RequestSearchParams = {
  categoryId?: string | undefined;
  actionId?: string | undefined;
};

export const Route = createFileRoute('/_auth/_app/create-request')({
  validateSearch: (search: Record<string, unknown>): RequestSearchParams => {
    return {
      categoryId: search.categoryId as string,
      actionId: search.actionId as string,
    };
  },
  component: CreateRequestPage,
});

function CreateRequestPage() {
  const { profile } = Route.useRouteContext()

  const [nowTimestamp] = useState(() => Date.now());

  const navigate = useNavigate();
  const search = useSearch({ from: '/_auth/_app/create-request' });
  const { categoryId, actionId } = search;

  // Selection State
  const selectedCategory = CATEGORY_INTENT.find((c) => c.id === categoryId) || null;
  let selectedAction = selectedCategory?.actions.find((a) => a.id === actionId) || null;
  
  if (!selectedAction && actionId) {
    if (actionId === 'custom_service') {
      selectedAction = {
        id: 'custom_service',
        label: 'Custom Service',
        type: 'service',
        tag: 'Custom'
      };
    } else if (actionId === 'custom_item') {
      selectedAction = {
        id: 'custom_item',
        label: 'Custom Item',
        type: 'item',
        tag: 'Custom'
      };
    }
  }

  // Form State
  const [petId, setPetId] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'now' | 'scheduled'>('now'); // Minutes
  const [duration, setDuration] = useState<number>(30); // Minutes
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [note, setNote] = useState('');

  // 1. Fetch Pets (help_details) for the PetPicker
  const { data: pets } = useQuery({
    queryKey: ['my_pets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('help_details')
        .select('id, name');
      if (error) throw error;
      return data;
    },
  });

  // 2. The RPC Mutation
  const createRequest = useMutation({
    mutationFn: async () => {
      const scheduledTimestamp = formatDate(new Date(scheduledTime || nowTimestamp));
      const { data, error } = await supabase.rpc('create_neighborhood_request', {
        p_category_id: selectedCategory?.id,
        p_action_id: selectedAction?.id,
        p_request_type: selectedAction?.type,
        p_subject_tag: selectedAction?.tag,
        p_details: note,
        p_duration: duration,
        p_scheduled_time: scheduledTimestamp,
        p_help_detail_id: petId, // Pass null if category doesn't require it
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      navigate({ to: '/dashboard' });
    },
  });

  const handleCategorySelect = (cat: Category) => {
    navigate({ search: { ...search, categoryId: cat.id } });
  };

  const handleActionSelect = (act: Action) => {
    navigate({ search: { ...search, actionId: act.id } });
  };

  const handleBack = () => {
    if (actionId) {
      // Drop actionId, keep categoryId (Goes from Step 3 -> Step 2)
      navigate({ search: { categoryId } });
    } else if (categoryId) {
      // Drop everything (Goes from Step 2 -> Step 1)
      navigate({ search: {} });
    } else {
      // Go back to dashboard
      navigate({ to: '/dashboard' });
    }
  };

  const formatDate = (date: Date) => {
    return date.toISOString().slice(0,16);
  }

  const step = !categoryId ? 1 : !actionId ? 2 : 3;
  const currentDate = new Date(nowTimestamp);
  const minDate = formatDate(currentDate);
  const maxDate = formatDate(new Date(nowTimestamp + 14 * 24 * 60 * 60 * 1000));
  const isCustomRequest = selectedAction?.id === 'custom_service' || selectedAction?.id === 'custom_item'

  return (
    <div className="artisan-page-focus py-2">
      <div className="artisan-container-large mx-auto">
        {/* --- Level 1: Category Selection --- */}
        {step === 1 && <CategoryGrid onBack={handleBack} onSelect={handleCategorySelect}/>}

        {/* --- Level 2: Action Selection --- */}
        {step === 2 && selectedCategory && (
          <ActionSelector 
            category={selectedCategory} 
            onBack={handleBack} 
            onSelect={handleActionSelect} 
          />
        )}

        {/* --- Level 3: Form Container (The Fork) --- */}
        {step === 3 && selectedAction && (
          <div className="space-y-2">
            <button onClick={handleBack} className="nav-link-back mb-6">
              <ChevronLeft className="w-4 h-4" /> Back to {selectedCategory?.label}
            </button>

            <header className="mb-6 text-center">
              <h2 className="artisan-header-title">{selectedAction.label}</h2>
            </header>

            {/* PetPicker Logic */}
            {selectedCategory?.requiresProfile && (
              <PetPicker 
                pets={pets || []} 
                selectedId={petId} 
                onSelect={(id) => setPetId(id)} 
              />
            )}
            <div className="artisan-card">
              <div className="artisan-card-inner !p-2 space-y-2 text-left">
                {/* Form Fork: TimingModule Logic */}
                {selectedAction.type === 'service' && (
                  <div className="detail-row">
                    {/* <div className="icon-box">
                      <Clock className="w-4 h-4 text-brand-green" />
                    </div> */}
                    <div className="flex-1">
                      <label className="text-label">When?</label>
                      <div className="grid grid-cols-2 gap-2 mb-4 mt-2">
                        <button 
                          onClick={() => setTimeframe('now')} 
                          className={`py-3 rounded-xl border-2 transition-all ${
                            timeframe === 'now' ? 'border-brand-green bg-brand-green text-white' : 'border-brand-stone text-brand-text'
                          }`}
                        >
                          As Soon As Possible
                        </button>
                        <button 
                          onClick={() => setTimeframe('scheduled')} 
                          className={`py-3 rounded-xl border-2 transition-all ${
                            timeframe === 'scheduled' ? 'border-brand-green bg-brand-green text-white' : 'border-brand-stone text-brand-text'
                          }`}
                        >
                          Schedule Later
                        </button>
                      </div>
                      {timeframe === 'scheduled' && (
                        <input 
                        type="datetime-local" 
                        min={minDate}
                        max={maxDate}
                        className="artisan-input text-sm mt-2"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                      />)}
                    </div>
                  </div>)}
                {selectedAction.type === 'service' && (
                  <div className='detail-row'>
                    <ServiceDurationField value={duration} onChange={setDuration} />
                  </div>
                )} 
                {selectedAction.type !== 'service' && (
                  /* Item Fork: Derives duration from Date Range */
                  <div className="detail-row">
                    <ItemDurationField start={minDate.split('T')[0]}
                        end={maxDate.split('T')[0]} onDurationChange={(mins) => {
                      setDuration(mins);
                    }} />
                  </div>
                )}

                <div className="detail-row">
                  <div className="flex-1">
                    <label className="text-label">Address (Verified)</label>
                    <p className="text-brand-dark truncate">{profile?.address}</p>
                    <p className="artisan-meta-tiny">Neighbors won't see your house number till you approve their offer.</p>
                  </div>
                </div>

                <div className="detail-row">
                  <div className="flex-1">
                    <label className="text-label">{isCustomRequest ? 'Custom Request Details' : 'Extra Details'}</label>
                    <textarea 
                      maxLength={280}
                      className="mt-2 artisan-input min-h-[100px] resize-none"
                      placeholder={isCustomRequest ? 'Add specific information about your request.' : 'e.g. Please don\'t ring the doorbell...'}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                </div>
              </div>  
              <div className="pt-4 text-center">
                  <button 
                    onClick={() => createRequest.mutate()}
                    disabled={createRequest.isPending || (selectedCategory?.requiresProfile && !petId)}
                    className="btn-primary w-full flex justify-center items-center gap-2"
                  >
                    {createRequest.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Post to Neighborhood
                  </button>
                  <button 
                    onClick={() => navigate({ to: '/dashboard' })} 
                    className="nav-link-back w-full justify-center mt-6"
                  >
                    Cancel Request
                  </button>
                </div>
            </div> 
          </div>
        )}
      </div>
    </div>
  );
}