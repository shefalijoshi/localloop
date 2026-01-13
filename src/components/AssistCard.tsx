import { Link } from '@tanstack/react-router';
import { format, addMinutes, intervalToDuration, formatDuration } from 'date-fns';
import { Clock, Calendar, ShieldAlert, ChevronRight, MapPin } from 'lucide-react';
import { CATEGORY_INTENT } from '../lib/categoryIntent';

interface AssistCardProps {
  assist: any;
  currentProfileId: string;
}

export function AssistCard({ assist, currentProfileId }: AssistCardProps) {
  const category = CATEGORY_INTENT.find(c => c.id === assist.category_id);
  const Icon = category?.icon || Clock;
  const brandColor = category?.color || 'bg-brand-green';

  const isHelper = assist.helper_id === currentProfileId;

  const action = category?.actions.find(a => a.id === assist.action_id);
  const actionLabel = action?.label || assist.subject_tag;

  // 2. Heading Logic: display_name + action label
  const heading = assist.display_name 
    ? `${assist.display_name} — ${actionLabel}`
    : actionLabel;

  // Timing Logic
  const startTime = new Date(assist.scheduled_time);
  const endTime = addMinutes(startTime, assist.expected_duration || 0);  

  return (
    <Link
      to="/assists/$assistId"
      params={{ assistId: assist.id }}
      className="block artisan-card px-4 pt-4 pb-2 hover:shadow-md transition-shadow group"
    >
      <div className="flex flex-col gap-2">
        {/* Header: Identity & Status */}
        <div className="flex justify-between items-start">
          <div className="flex gap-3 items-center">
            <div className={`icon-box transition-transform group-hover:scale-110 ${brandColor} border-none text-white shadow-md`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="artisan-card-title !text-xl">
                {heading}
              </h3>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 justify-between">
          <span className="badge-pill !bg-brand-terracotta !text-white !text-[9px] !py-0.5 line-clamp-2">
            {assist.status.replace('_', ' ')} with {isHelper ? assist.seeker_name : assist.helper_name}
          </span>
          <div className="flex items-center gap-1 justify-end text-brand-dark">
            <ShieldAlert className="w-3 h-3 text-brand-terracotta" /> 
            <span className="text-xs font-mono tracking-tighter">
              Code {assist.verification_code}
            </span>
          </div>
        </div>

        {/* Metadata: Category Tag & Duration/Return Date */}
        <div className="detail-row pt-2 border-t border-brand-stone">
          <div className="flex flex-wrap items-center gap-3 w-full">
            <span className="badge-pill hidden sm:inline-flex">
              {assist.subject_tag}
            </span>

            {assist.request_type === 'service' && (
              <div className="flex items-center gap-1 text-brand-text text-[13px]">
                <Calendar className="w-4 h-4 opacity-70" />
                <span>{format(startTime, 'MMM d HH:mm a')}</span>
              </div>)}
              {assist.request_type === 'service' && ( 
              <div className="flex items-center gap-1 text-brand-text text-[13px]">
                <Clock className="w-4 h-4 opacity-70" />
                <span>{formatDuration(intervalToDuration({start: 0, end: assist.expected_duration * 60 * 1000}), {delimiter: ', '})}</span>
              </div>)}
              {assist.request_type === 'item' && (
                <div className="flex items-center gap-1 text-brand-text text-[13px]">
                  <Calendar className="w-4 h-4 opacity-70" />
                  <span>Return {format(endTime, 'MMM d')}</span>
                </div>
              )}
              {assist.seeker_address && (
              <div className="flex items-center gap-1 text-brand-text text-[13px]">
                <MapPin className="w-4 h-4 opacity-80" />
                <span className="tracking-wider">{assist.seeker_address}</span>
              </div>)}

            <div className="ml-auto">
              <ChevronRight className="w-5 h-5 text-brand-stone group-hover:text-brand-green transition-colors" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}