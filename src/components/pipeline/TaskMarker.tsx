'use client';

interface TaskMarkerProps {
  count: number;
  onClick: (e: React.MouseEvent) => void;
}

export function TaskMarker({ count, onClick }: TaskMarkerProps) {
  return (
    <button
      onClick={onClick}
      className="absolute top-1 right-1 w-[18px] h-[18px] rounded-full bg-spectral text-white text-[10px] font-bold flex items-center justify-center leading-none hover:scale-110 transition-transform z-10"
      title={`${count} task${count !== 1 ? 's' : ''} due`}
    >
      {count}
    </button>
  );
}
