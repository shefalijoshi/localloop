import { Link } from '@tanstack/react-router';
import { format, addMinutes } from 'date-fns';
import { Clock, MapPin, Calendar, Hand, ChevronRight } from 'lucide-react';
import { CATEGORY_INTENT } from '../lib/categoryIntent';

interface RequestCardProps {
  request: any;
  isMine: boolean;
  hasMyOffer: boolean;
}

export function RequestCard({ request, isMine, hasMyOffer }: RequestCardProps) {
  // 1. Category is always known - use it for branding
  const category = CATEGORY_INTENT.find((c) => c.id === request.category_id);
  const Icon = category?.icon || Clock;
  const brandColor = category?.color || 'bg-brand-green';

  const action = category?.actions.find(a => a.id === request.action_id);
  const actionLabel = action?.label || '';

  // 2. Heading Logic: display_name + action label
  let heading = request?.display_name || '';
  if (actionLabel) {
    heading = heading ? `${heading} - ${actionLabel}` : `${actionLabel}`;
  }
  if (!heading) {
    heading = request.request_type === 'item' ? 'Item Requested' : 'Service Requested';
  }
    
  // 3. Timing Logic
  const startTime = new Date(request.scheduled_time);
  const returnTime = addMinutes(startTime, request.duration || 0);

  return (
    <Link 
      to="/requests/$requestId" 
      params={{ requestId: request.id }}
      className="block artisan-card px-4 pt-4 pb-2 hover:shadow-md transition-shadow group"
    >
      <div className="flex flex-col gap-">
        {/* Header Section */}
        <div className="flex justify-between items-start">
          <div className="flex gap-3 items-center">
            <div className={`icon-box mb-2 transition-transform group-hover:scale-110 ${brandColor} border-none text-white shadow-md`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="artisan-card-title !text-xl !truncate max-w-[200px]">
                {heading}
              </h3>
              <p className="artisan-meta-tiny !text-brand-muted">
                {category?.label}
              </p>
            </div>
            
            {isMine && request.offer_count > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-brand-terracotta text-white rounded-full">
                <Hand className="w-3 h-3" />
                <span className="text-[10px] font-bold">{request.offer_count}</span>
              </div>
            )}
          </div>
          
          <div className="text-right pt-2">
            <div className="flex items-center gap-1 justify-end text-label">
              <Clock className="w-3 h-3 text-brand-muted" /> 
              <span className="artisan-meta-tiny text-brand-muted">
                {isMine 
                  ? `Ends ${format(new Date(request.expires_at), 'p')}`
                  : hasMyOffer ? 'Offer pending' : `By ${format(new Date(request.expires_at), 'p')}`
                }
              </span>
            </div>
          </div>
        </div>

        
        {request.details && !actionLabel && (
          <div className='!py-0'>
            <q className="text-brand-text mt-1 line-clamp-2 opacity-90 italic text-sm">
              {request.details}
            </q>
          </div>
        )}            
        
        {/* Metadata Details */}
        <div className="detail-row border-t border-brand-stone">
          <div className="flex flex-wrap items-center gap-3">
              <span className="badge-pill hidden sm:inline-flex">
                {request.subject_tag}
              </span>

              {/* Item Borrow Window */}
              {request.request_type === 'item' && (
                <div className="flex items-center gap-1 text-brand-text text-[13px]">
                  <Calendar className="w-4 h-4" />
                  <span>{format(startTime, 'MMM d')} - {format(returnTime, 'MMM d')}</span>
                </div>
              )}
              
              {/* Service start time */}
              {request.request_type === 'service' && (
                <div className="flex items-center gap-1 text-brand-text text-[13px]">
                  <Calendar className="w-4 h-4" />
                  <span>{format(startTime, 'MMM d HH:mm a')}</span>
                </div>
              )}

              {/* Service Duration */}
              {request.request_type === 'service' && (
                <div className="flex items-center gap-1 text-brand-text text-[13px]">
                  <Clock className="w-4 h-4" />
                  <span>{request.duration}m</span>
                </div>
              )}

              <div className="flex items-center gap-1 text-brand-text text-[13px]">
                <MapPin className="w-4 h-4 opacity-80" />
                <span className="tracking-wider">{request.street_name}</span>
              </div>
          </div>
          
          <div className="ml-auto">
            <ChevronRight className="w-5 h-5 text-brand-stone group-hover:text-brand-green transition-colors" />
          </div>
        </div>
      </div>
    </Link>
  );
}