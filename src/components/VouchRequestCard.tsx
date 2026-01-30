import { format, differenceInMinutes } from 'date-fns';
import { Clock, StarIcon, SparklesIcon, UserPlus, Lock } from 'lucide-react';

export interface JoinRequestProps {
  membership_id: string;
  profile_id: string;
  display_name: string;
  street_name: string;
  location_verified: boolean;
  vouch_verification_code: string;
  created_at: string;
  vouch_code_expires_at: string;
}

interface VouchRequestCardProps {
  request: JoinRequestProps;
  currentTime?: number;
  onApprove?: () => void;
  disabled: boolean;
}

export function VouchRequestCard({ request, currentTime = new Date().getTime(), onApprove, disabled }: VouchRequestCardProps) {    
  const vouchCodeExpirationTime = new Date(request.vouch_code_expires_at);
  const minutesTillExpiration = differenceInMinutes(vouchCodeExpirationTime, currentTime);

  const getBadge = () => {    
    const requestedTime = new Date(request.created_at).getTime();
    if (minutesTillExpiration < 240 && minutesTillExpiration > 0) {
      return { label: 'Urgent', color: 'bg-red-500' };
    }
    const minutesSinceRequested = differenceInMinutes(new Date(currentTime), new Date(requestedTime));
    if (minutesSinceRequested < 120) {
      return { label: 'New', color: 'bg-brand-green' };
    }
    return null;
  };

  const badge = getBadge();

  return (
    <div className="card-feature card-trust group relative overflow-visible px-6 pt-6"
    >
      {badge && badge.label === 'Urgent' && (
        <div className="badge-urgent"/>
      )}
      {badge && badge.label === 'New' && (
        <div className="badge-new"/>
      )}
      <div className="flex flex-col gap-6 md:gap-2">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4">
          <div className="flex gap-4 items-start flex-1 min-w-0">
            <div className="icon-box">
              <UserPlus className="w-5 h-5 text-brand-green" />
            </div>
            <div className="flex flex-col min-w-0">
              <h3 className="artisan-header-title !text-lg !mb-0 truncate">
                {request?.display_name || 'Neighbor'}
              </h3>
              <span className="text-brand-text font-medium opacity-70 text-sm truncate">
                at {request?.street_name || 'unknown location'}
              </span>
            </div>
          </div>
          <button
            onClick={onApprove}
            disabled={disabled}
            className="btn-primary !py-2 !px-6 w-auto shrink-0 shadow-sm w-full sm:w-auto">
              Approve
          </button>
        </div>       
        
        {/* Metadata Details */}
        <div className="detail-row flex-wrap gap-y-4 items-center justify-between border-t border-brand-stone pt-4 mt-2">
          {!request.location_verified && (
            <div className="flex items-center gap-2">
              <div className="gps-indicator">
                <span className="gps-indicator-ping"></span>
                <span className="gps-indicator-dot"></span>
              </div>
              <span className="artisan-meta-tiny">Location Verified</span>
            </div>
          )}
          <div className="flex items-center gap-4 ml-auto sm:ml-0">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-brand-terracotta" /> 
              <span className="artisan-meta-tiny font-mono">
                Approve by {format(new Date(vouchCodeExpirationTime), 'eeeeee p')}
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-brand-stone/50 px-3 py-1 rounded-md border border-brand-border/50">
              <Lock className="w-3 h-3 text-brand-muted" /> 
              <span className="text-[11px] font-black font-mono tracking-wider text-brand-dark">
                {request.vouch_verification_code}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}