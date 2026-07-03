'use client';

import { motion } from 'motion/react';
import { useEffect, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

interface Sparkle {
  id: string;
  x: string;
  y: string;
  color: string;
  delay: number;
  scale: number;
  lifespan: number;
}

const generateSparkle = (color: string): Sparkle => ({
  id: String(Math.random()),
  x: `${Math.random() * 100}%`,
  y: `${Math.random() * 100}%`,
  color,
  delay: Math.random() * 2,
  scale: Math.random() * 1 + 0.3,
  lifespan: Math.random() * 10 + 5,
});

const SparkleSvg = ({ size = 21, color = '#FFC700' }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 21 21"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9.82531 0.843845C10.0553 0.215178 10.9446 0.215178 11.1746 0.843845L11.8618 2.72026C12.4006 4.19229 12.3916 6.39157 13.5 7.5C14.6084 8.60843 16.8077 8.59935 18.2797 9.13822L20.1561 9.82534C20.7858 10.0553 20.7858 10.9447 20.1561 11.1747L18.2797 11.8618C16.8077 12.4007 14.6084 12.3916 13.5 13.5C12.3916 14.6084 12.4006 16.8077 11.8618 18.2798L11.1746 20.1562C10.9446 20.7858 10.0553 20.7858 9.82531 20.1562L9.13819 18.2798C8.59932 16.8077 8.60843 14.6084 7.5 13.5C6.39157 12.3916 4.19225 12.4007 2.72023 11.8618L0.843814 11.1747C0.215148 10.9447 0.215148 10.0553 0.843814 9.82534L2.72023 9.13822C4.19225 8.59935 6.39157 8.60843 7.5 7.5C8.60843 6.39157 8.59932 4.19229 9.13819 2.72026L9.82531 0.843845Z"
      fill={color}
    />
  </svg>
);

export function SparklesText({
  text,
  colors = { first: '#a3e635', second: '#22d3ee' },
  className,
  sparklesCount = 8,
  ...props
}: {
  text: string;
  colors?: { first: string; second: string };
  className?: string;
  sparklesCount?: number;
}) {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

  useEffect(() => {
    const generate = () => {
      const next: Sparkle[] = [];
      for (let i = 0; i < sparklesCount; i++) {
        next.push(generateSparkle(i % 2 === 0 ? colors.first : colors.second));
      }
      setSparkles(next);
    };
    generate();
    const id = setInterval(generate, 3000);
    return () => clearInterval(id);
  }, [colors.first, colors.second, sparklesCount]);

  return (
    <span
      className={cn('relative inline-block', className)}
      style={
        {
          '--sparkles-first-color': colors.first,
          '--sparkles-second-color': colors.second,
        } as CSSProperties
      }
      {...props}
    >
      {sparkles.map((sparkle) => (
        <motion.span
          key={sparkle.id}
          className="pointer-events-none absolute"
          style={{ top: sparkle.y, left: sparkle.x }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0, sparkle.scale, 0], rotate: [0, 90, 180] }}
          transition={{ duration: 1.6, delay: sparkle.delay, repeat: Infinity, repeatDelay: 2 }}
        >
          <SparkleSvg color={sparkle.color} size={14} />
        </motion.span>
      ))}
      <strong className="relative">{text}</strong>
    </span>
  );
}
