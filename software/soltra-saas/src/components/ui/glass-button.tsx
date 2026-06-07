"use client";

import React, { useRef, useState } from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface GlassButtonProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
  primary?: boolean;
  dark?: boolean;
}

export function GlassButton({ children, primary = false, dark = false, className, ...props }: GlassButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e: React.MouseEvent<HTMLButtonElement>) => {
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current!.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    setPosition({ x: middleX * 0.15, y: middleY * 0.15 });
  };

  const reset = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
      className={cn(
        "relative px-8 py-4 font-sans transition-all duration-300 active:scale-95 overflow-hidden group border",
        primary 
          ? "bg-primary/20 text-primary border-primary/50 backdrop-blur-xl shadow-[0_0_20px_rgba(0,217,255,0.2)] hover:shadow-[0_0_40px_rgba(0,217,255,0.5)] hover:bg-primary/30 hover:text-white" 
          : dark
          ? "bg-black/20 text-black border-black/20 backdrop-blur-xl hover:bg-black/30"
          : "bg-white/5 border-white/20 text-white backdrop-blur-md hover:bg-white/10",
        className
      )}
      {...props}
    >
      {/* Shine effect */}
      <span className={cn(
        "absolute inset-0 -translate-x-[150%] skew-x-[-20deg] w-[50%] group-hover:animate-[shimmer_1.5s_infinite]",
        dark ? "bg-gradient-to-r from-transparent via-black/20 to-transparent" : "bg-gradient-to-r from-transparent via-white/20 to-transparent"
      )} />
      <span className="relative z-10 flex items-center justify-center gap-4">{children}</span>
    </motion.button>
  );
}
