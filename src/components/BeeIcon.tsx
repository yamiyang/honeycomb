"use client";

import { motion } from "framer-motion";
import type { BeeStatus } from "@/types";

interface BeeIconProps {
  status?: BeeStatus;
  size?: number;
  className?: string;
  animate?: boolean;
}

const statusColors: Record<BeeStatus, string> = {
  idle: "#ffc107",
  searching: "#ffe485",
  analyzing: "#c9a0dc",
  returning: "#e6a800",
  resting: "#ffc107",
  error: "#ff6b6b",
  retired: "#ccc",
};

export default function BeeIcon({ status = "idle", size = 32, className = "", animate = true }: BeeIconProps) {
  const color = statusColors[status];
  const isActive = status === "searching" || status === "analyzing" || status === "returning";

  return (
    <motion.div
      className={className}
      animate={
        animate && isActive
          ? {
              y: [0, -4, 0, -6, 0],
              rotate: [0, 3, -2, 4, 0],
            }
          : {}
      }
      transition={
        isActive
          ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
          : {}
      }
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Wings */}
        <ellipse cx="20" cy="18" rx="10" ry="7" fill="#e3f2fd" opacity="0.8">
          {animate && isActive && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="-10 20 18;10 20 18;-10 20 18"
              dur="0.2s"
              repeatCount="indefinite"
            />
          )}
        </ellipse>
        <ellipse cx="44" cy="18" rx="10" ry="7" fill="#e3f2fd" opacity="0.8">
          {animate && isActive && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="10 44 18;-10 44 18;10 44 18"
              dur="0.2s"
              repeatCount="indefinite"
            />
          )}
        </ellipse>

        {/* Body */}
        <ellipse cx="32" cy="34" rx="16" ry="18" fill={color} />

        {/* Stripes */}
        <rect x="16" y="28" width="32" height="4" rx="2" fill="#3d2c00" opacity="0.6" />
        <rect x="16" y="36" width="32" height="4" rx="2" fill="#3d2c00" opacity="0.6" />

        {/* Head */}
        <circle cx="32" cy="14" r="10" fill={color} />

        {/* Eyes */}
        <circle cx="27" cy="12" r="3" fill="white" />
        <circle cx="37" cy="12" r="3" fill="white" />
        <circle cx="28" cy="12" r="1.5" fill="#3d2c00" />
        <circle cx="38" cy="12" r="1.5" fill="#3d2c00" />

        {/* Smile */}
        <path d="M28 17 Q32 21 36 17" stroke="#3d2c00" strokeWidth="1.5" fill="none" strokeLinecap="round" />

        {/* Antennae */}
        <path d="M28 6 Q25 0 22 2" stroke="#3d2c00" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M36 6 Q39 0 42 2" stroke="#3d2c00" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <circle cx="22" cy="2" r="2" fill="#ffd54f" />
        <circle cx="42" cy="2" r="2" fill="#ffd54f" />

        {/* Stinger */}
        <path d="M32 52 L30 56 L34 56 Z" fill="#8b6914" />

        {/* Honey carrying indicator */}
        {status === "returning" && (
          <g>
            <circle cx="32" cy="50" r="5" fill="#ffc107" stroke="#e6a800" strokeWidth="1" />
            <text x="32" y="52" textAnchor="middle" fontSize="6" fill="#3d2c00">🍯</text>
          </g>
        )}
      </svg>
    </motion.div>
  );
}
