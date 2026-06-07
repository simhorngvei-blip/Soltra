"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { name: "Avatar Core", href: "#avatar-core" },
  { name: "Architecture", href: "#specs" },
  { name: "Pricing", href: "#purchase" },
];

export function AnimatedNav() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="flex items-center justify-center p-1 bg-white/5 border border-white/10 rounded-full backdrop-blur-md">
      {NAV_LINKS.map((link, index) => (
        <a
          key={link.name}
          href={link.href}
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
          className="relative px-6 py-2 rounded-full cursor-pointer transition-colors duration-200"
        >
          <span
            className={cn(
              "relative z-10 text-[10px] font-mono tracking-[0.4em] uppercase whitespace-nowrap transition-colors duration-300",
              hoveredIndex === index ? "text-black" : "text-zinc-400"
            )}
          >
            {link.name}
          </span>
          <AnimatePresence>
            {hoveredIndex === index && (
              <motion.div
                layoutId="nav-pill"
                className="absolute inset-0 bg-primary rounded-full z-0 shadow-[0_0_15px_rgba(0,217,255,0.4)]"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                  mass: 0.8
                }}
              />
            )}
          </AnimatePresence>
        </a>
      ))}
    </div>
  );
}
