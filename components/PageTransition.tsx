"use client";

import { useEffect, useRef, ReactNode } from "react";
import { usePathname } from "next/navigation";

export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Remove transitioning class and trigger fade in
    document.body.classList.remove("page-transitioning");
    
    // Add fade-in class
    if (containerRef.current) {
      containerRef.current.classList.add("page-enter");
      
      // Remove class after animation
      const timer = setTimeout(() => {
        containerRef.current?.classList.remove("page-enter");
      }, 400);
      
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return (
    <div ref={containerRef} className="page-container">
      {children}
    </div>
  );
}
