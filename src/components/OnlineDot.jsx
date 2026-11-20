import { usePresence } from '../hooks/usePresence';

export default function OnlineDot({ userId, myId, variant = 'text', className = '' }) {
  const status = usePresence(userId, myId);

  if (!userId || !myId || !status) return null;

  const isOnline = status.is_online;

  // Facebook Style: Bottom-right green dot on the avatar
  if (variant === 'avatar') {
    return (
      <span
        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0B0B14] ${isOnline ? 'bg-emerald-500' : 'bg-gray-500'} ${className}`}
        title={isOnline ? "Online" : "Offline"}
      />
    );
  }

  // Facebook Style: Green dot + "Active now" text next to the name
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-gray-500'}`} />
      <span className={`text-[11px] font-medium ${isOnline ? 'text-emerald-500' : 'text-gray-400'}`}>
        {isOnline ? 'Active now' : status.last_seen_at ? `Active ${new Date(status.last_seen_at).toLocaleDateString()}` : 'Offline'}
      </span>
    </div>
  );
}
