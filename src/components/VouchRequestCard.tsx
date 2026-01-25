import { format, differenceInMinutes } from 'date-fns';
import { Clock, StarIcon, SparklesIcon, UserPlus, Lock, MapPinCheck } from 'lucide-react';

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
  const heading = `${request?.display_name || 'Your neighbor'} at ${request?.street_name || 'unknown location'}`;
    
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
    <div className={`block artisan-card border-brand-green p-2 mb-2 hover:shadow-md transition-shadow group relative overflow-visible`}
    >
      {badge && badge.label === 'Urgent' && (
        <div className="absolute -top-7 -right-7 z-20 rotate-12 flex items-center justify-center">
          <StarIcon
            size={58} 
            className="text-red-500 fill-red-500 drop-shadow-md" 
            strokeWidth={1}
          />
          <div className="absolute flex flex-col items-center justify-center text-white">
            <span className="text-[10px] font-black tracking-tighter leading-none">
              Urgent
            </span>
          </div>
        </div>
      )}
      {badge && badge.label === 'New' && (
        <div className="absolute -top-7 -right-7 z-20 flex items-center justify-center">
          <SparklesIcon 
            size={58} 
            className="text-yellow-300 fill-yellow-300 drop-shadow-sm" 
            strokeWidth={1}
          />
          <div className="absolute flex flex-col items-center justify-center text-brand-dark">
            <span className="text-[12px] font-black tracking-tighter leading-none">
              New
            </span>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-">
        {/* Header Section */}
        <div className="flex justify-between items-start">
          <div className="flex gap-3 items-center">
            <div className={`icon-box mb-2 transition-transform group-hover:scale-110 bg-brand-green border-none text-white shadow-md`}>
              <UserPlus className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h3 className="artisan-card-title text-wrap !text-xl">
                {heading}
              </h3>
            </div>
          </div>
          <button
            onClick={onApprove}
            disabled={disabled}
            className="pill-primary">
              Approve
          </button>
        </div>       
        
        {/* Metadata Details */}
        <div className="flex items-center gap-1 justify-between mt-1 pt-1 border-t border-brand-stone">
          {!request.location_verified && (
            <div className={`flex items-center gap-1 artisan-meta-tiny`}>
              <MapPinCheck className="w-5 h-5 text-brand-green" />
              <span className="text-brand-muted">Location Verified</span>
            </div>
          )}
          <div className="flex items-center gap-1 justify-end">
            <Clock className="w-5 h-5 text-brand-terracotta" /> 
            <span className="text-brand-muted artisan-meta-tiny">
              Approve by {format(new Date(vouchCodeExpirationTime), 'eeeeee p')}
            </span>
          </div>
          <div className="flex items-center gap-1 justify-end px-2 py-1 rounded-lg">
            <Lock className="w-3 h-3" /> 
            <span className="text-xs text-brand-muted font-mono tracking-tighter">
              {request.vouch_verification_code}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}