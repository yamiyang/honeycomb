"use client";

import { motion } from "framer-motion";

interface HexagonNodeProps {
  label: string;
  type?: string;
  size?: number;
  filled?: boolean;
  glowing?: boolean;
  onClick?: () => void;
}

const typeColors: Record<string, string> = {
  concept: "#ffc107",
  entity: "#e6a800",
  fact: "#a8d85e",
  source: "#87ceeb",
  topic: "#ffb6c1",
};

export default function HexagonNode({
  label,
  type = "concept",
  size = 60,
  filled = true,
  glowing = false,
  onClick,
}: HexagonNodeProps) {
  const color = typeColors[type] || typeColors.concept;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="relative cursor-pointer group"
      style={{ width: size, height: size * 1.15 }}
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
    >
      <svg width={size} height={size * 1.15} viewBox="0 0 100 115">
        <polygon
          points="50,0 100,28.75 100,86.25 50,115 0,86.25 0,28.75"
          fill={filled ? color : "transparent"}
          stroke={color}
          strokeWidth="3"
          opacity={filled ? 1 : 0.5}
        />
        {glowing && (
          <polygon
            points="50,0 100,28.75 100,86.25 50,115 0,86.25 0,28.75"
            fill="none"
            stroke={color}
            strokeWidth="2"
            opacity="0.5"
          >
            <animate
              attributeName="stroke-width"
              values="2;6;2"
              dur="1.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.5;0.2;0.5"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </polygon>
        )}
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-center px-1"
        style={{ fontSize: Math.max(8, size * 0.14) }}
      >
        <span className="font-medium text-bee-dark leading-tight line-clamp-2 drop-shadow-sm">
          {label.length > 8 ? label.slice(0, 8) + "…" : label}
        </span>
      </div>
    </motion.div>
  );
}
