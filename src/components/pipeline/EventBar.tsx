'use client';

import { tierBarColors, type EventTier } from '@/types/database';

interface EventBarProps {
  id: string;
  name: string;
  tier: string | null;
  startCol: number;
  endCol: number;
  slotIndex: number;
  isStart: boolean;
  isEnd: boolean;
  onClick: () => void;
}

export function EventBar({
  name,
  tier,
  startCol,
  endCol,
  slotIndex,
  isStart,
  isEnd,
  onClick,
}: EventBarProps) {
  const bgColor = tier && tier in tierBarColors
    ? tierBarColors[tier as EventTier]
    : 'bg-gray-400 dark:bg-gray-600';

  const left = `${(startCol / 7) * 100}%`;
  const width = `${((endCol - startCol + 1) / 7) * 100}%`;
  const top = `${slotIndex * 26}px`;

  const roundedLeft = isStart ? 'rounded-l-md' : '';
  const roundedRight = isEnd ? 'rounded-r-md' : '';

  return (
    <div
      className={`absolute h-[22px] ${bgColor} ${roundedLeft} ${roundedRight} text-white text-xs leading-[22px] px-1.5 truncate cursor-pointer pointer-events-auto hover:brightness-110 transition-all`}
      style={{ left, width, top }}
      onClick={onClick}
      title={name}
    >
      {isStart && <span className="truncate">{name}</span>}
    </div>
  );
}
