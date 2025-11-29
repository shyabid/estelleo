"use client";

import { useState, useEffect } from "react";

interface ProgressiveImageProps {
  src: string;
  placeholderColor?: string;
  blurDataUrl?: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
}

export default function ProgressiveImage({
  src,
  placeholderColor = "#f0f0f0",
  blurDataUrl,
  alt,
  className,
  style,
  onClick
}: ProgressiveImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div 
      className={`relative overflow-hidden ${className}`} 
      style={{ ...style, backgroundColor: placeholderColor }}
      onClick={onClick}
    >
      {/* Low Res Blur - Acts as the spacer for aspect ratio */}
      {blurDataUrl ? (
        <img
          src={blurDataUrl}
          alt={alt}
          className={`block w-full h-auto object-cover transition-opacity duration-700 ease-in-out ${
            isLoaded ? "opacity-0" : "opacity-100"
          }`}
          style={{ filter: "blur(20px)", transform: "scale(1.1)" }} 
        />
      ) : (
        // Fallback spacer if no blur data (shouldn't happen often if generated correctly)
        // We render the main image as relative in this case to set height
        <img 
           src={src} 
           className="invisible w-full h-auto" 
           alt="spacer"
        />
      )}

      {/* Full Res - Absolute overlay */}
      <img
        src={src}
        alt={alt}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setIsLoaded(true)}
        loading="lazy"
      />
    </div>
  );
}
