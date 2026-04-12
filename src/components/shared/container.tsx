import type { PropsWithChildren } from "react";

import { cn } from "@/lib/cn";

type ContainerProps = PropsWithChildren<{
  className?: string;
}>;

export function Container({ className, children }: ContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-10", className)}>
      {children}
    </div>
  );
}
