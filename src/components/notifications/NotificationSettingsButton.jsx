// ─────────────────────────────────────────────────────────────────────────────
// NotificationSettingsButton
// A compact toggle button for the TopBar — shows current push notification state
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Bell, BellOff, BellRing, Loader2, BellPlus } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const NotificationSettingsButton = () => {
  const { status, subscribe, unsubscribe, isLoading, isSupported, isDenied } = usePushNotifications();

  if (!isSupported) return null;

  const handleClick = () => {
    if (status === 'subscribed') {
      unsubscribe();
    } else if (!isDenied) {
      subscribe();
    }
  };

  const getIcon = () => {
    if (isLoading) return <Loader2 size={16} className="animate-spin" />;
    if (status === 'subscribed') return <BellRing size={16} className="text-primary" />;
    if (isDenied) return <BellOff size={16} className="text-rose-400" />;
    return <Bell size={16} className="text-white/50" />;
  };

  const getTooltip = () => {
    if (isLoading) return 'Please wait…';
    if (status === 'subscribed') return 'Notifications ON — click to disable';
    if (isDenied) return 'Notifications blocked in browser settings';
    return 'Enable push notifications';
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading || isDenied}
      title={getTooltip()}
      aria-label={getTooltip()}
      className={`
        p-2 rounded-xl transition-all duration-200
        ${status === 'subscribed'
          ? 'bg-primary/10 hover:bg-primary/20'
          : 'bg-white/5 hover:bg-white/10'
        }
        ${isDenied ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${isLoading ? 'opacity-70' : ''}
      `}
    >
      {getIcon()}
    </button>
  );
};

export default NotificationSettingsButton;
