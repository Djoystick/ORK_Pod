"use client";

import type { PropsWithChildren } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/cn";

type RevealProps = PropsWithChildren<{
  className?: string;
  delay?: number;
}>;

export function Reveal({ className, delay = 0, children }: RevealProps) {
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.42, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}
