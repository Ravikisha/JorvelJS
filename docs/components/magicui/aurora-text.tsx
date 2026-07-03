import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AuroraTextProps {
  children: ReactNode;
  className?: string;
  colors?: string[];
  speed?: number;
}

export const AuroraText = memo(function AuroraText({
  children,
  className,
  colors = ['#a3e635', '#22d3ee', '#a855f7', '#ec4899'],
  speed = 1,
}: AuroraTextProps) {
  const gradient = `linear-gradient(135deg, ${colors.join(', ')}, ${colors[0]})`;
  return (
    <span
      className={cn('relative inline-block', className)}
      style={{
        backgroundImage: gradient,
        backgroundSize: '200% 200%',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        animation: `aurora-text ${10 / speed}s ease infinite`,
      }}
    >
      {children}
    </span>
  );
});
