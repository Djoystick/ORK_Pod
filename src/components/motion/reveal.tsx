"use client";

import type { PropsWithChildren } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/cn";

type RevealProps = PropsWithChildren<{
  className?: string;
  delay?: number;
  distance?: number;
}>;

export function Reveal({ className, delay = 0, distance = 16, children }: RevealProps) {
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: distance, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
