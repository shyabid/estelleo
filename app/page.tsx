"use client";

import { useRef, useEffect, useState } from "react";
import Lenis from "lenis";
import ProgressiveImage from "@/components/ProgressiveImage";

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const gallerySectionRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const lastScrollTime = useRef(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [featuredImages, setFeaturedImages] = useState<string[]>([]);

  const [images, setImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageDescriptions, setImageDescriptions] = useState<Record<string, { 
    title?: string; 
    description: string; 
    date?: string;
    color?: string;
    blurDataUrl?: string;
  }>>({});

  // Helper to calculate circular distance for the carousel
  const getDistanceFromCenter = (index: number, centerIndex: number, total: number) => {
    let diff = index - centerIndex;
    // Adjust for wrap-around
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;
    return diff;
  };

  // Fetch image descriptions
  useEffect(() => {
    fetch("/api/data")
      .then((res) => res.json())
      .then((data) => setImageDescriptions(data))
      .catch((err) => console.error("Failed to load descriptions", err));
  }, []);

  const getImageInfo = (imageName: string) => {
    return imageDescriptions[imageName] || {
      title: imageName.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
      description: "A beautiful piece from my art collection.",
      date: undefined
    };
  };

  const scrollToGallery = () => {
    if (gallerySectionRef.current && lenisRef.current) {
      lenisRef.current.scrollTo(gallerySectionRef.current, { offset: -50 });
    }
  };

  // Fetch featured images from API
  useEffect(() => {
    fetch("/api/images?type=featured")
      .then((res) => res.json())
      .then((data) => setFeaturedImages(data))
      .catch(() => setFeaturedImages([]));
  }, []);

  useEffect(() => {
    // Initialize Lenis for smooth scrolling
    const lenis = new Lenis({
      duration: 1.20,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    
    lenisRef.current = lenis;

    // Animation frame loop for Lenis
    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Handle scroll for horizontal gallery
    const handleScroll = () => {
      const container = containerRef.current;
      const gallery = galleryRef.current;
      if (!container || !gallery) return;

      const rect = container.getBoundingClientRect();
      const progress = -rect.top / (container.offsetHeight - window.innerHeight);
      const clampedProgress = Math.max(0, Math.min(1, progress));
      setScrollProgress(clampedProgress);
    };

    lenis.on("scroll", handleScroll);

    return () => {
      lenis.destroy();
    };
  }, []);

  // Apply smooth transform to gallery
  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery) return;

    const maxScroll = gallery.scrollWidth - window.innerWidth;
    gallery.style.transform = `translateX(-${scrollProgress * maxScroll}px)`;
  }, [scrollProgress]);

  useEffect(() => {
    fetch("/api/images?type=all")
      .then((res) => res.json())
      .then((data) => setImages(data))
      .catch(() => setImages([]));
  }, []);

  // Close lightbox on escape and navigate with arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedImage(null);
      if (selectedImage && images.length > 0) {
        if (e.key === "ArrowLeft") navigateImage("prev");
        if (e.key === "ArrowRight") navigateImage("next");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImage, images]);

  const navigateImage = (direction: "prev" | "next") => {
    if (!selectedImage || images.length === 0) return;
    
    const currentIndex = images.indexOf(selectedImage);
    const targetIndex = direction === "prev" 
      ? (currentIndex > 0 ? currentIndex - 1 : images.length - 1)
      : (currentIndex < images.length - 1 ? currentIndex + 1 : 0);
    
    setSelectedImage(images[targetIndex]);
  };

  // Lock body scroll and Lenis when lightbox is open
  useEffect(() => {
    if (selectedImage) {
      lenisRef.current?.stop();
      document.body.style.overflow = "hidden";
    } else {
      lenisRef.current?.start();
      document.body.style.overflow = "";
    }
    return () => {
      lenisRef.current?.start();
      document.body.style.overflow = "";
    };
  }, [selectedImage]);

  // Handle wheel scroll for navigation
  useEffect(() => {
    if (!selectedImage) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); // Prevent default scroll
      
      const now = Date.now();
      if (now - lastScrollTime.current < 500) return; // 500ms cooldown to prevent rapid scrolling

      // Check if scroll is significant enough
      if (Math.abs(e.deltaY) > 10 || Math.abs(e.deltaX) > 10) {
        lastScrollTime.current = now;
        if (e.deltaY > 0 || e.deltaX > 0) {
          navigateImage("next");
        } else {
          navigateImage("prev");
        }
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [selectedImage, images]);

  return (
    
    <div className="bg-pink-100/90">

      <div className="min-h-[2vh] md:min-h-[5vh]"></div>
      <div className="flex min-h-[80vh] md:min-h-[90vh] items-center justify-center mx-4 md:mx-10 font-sans bg-white rounded-[3vh] md:rounded-[5vh]">

        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 text-center md:text-left">
          
          {/* Image */}
          <img
            src="https://cdn.discordapp.com/emojis/1407426214548738048.webp?animated=true"
            className="w-[20vw] md:w-[6vw] min-w-[60px] md:min-w-[40px]"
            alt=""
          />

          {/* Text column */}
          <div className="flex flex-col">
            <p className="text-[8vw] md:text-[2vw] leading-none font-semibold">
              ESTELLEO
            </p>
            <p className="text-[3.5vw] md:text-[1vw] opacity-70 mt-2 md:mt-0">
              ★ ! 2007  ·  <u>Artist</u>  ˙  ENFJ 
            </p>
          </div>

        </div>
        
      </div>

      {/* Horizontal scroll section */}
      <div ref={containerRef} className="h-[200vh] md:h-[300vh] relative">
        <div className="sticky top-0 h-screen overflow-hidden flex flex-col justify-center">

          <div className="absolute top-8 md:top-8 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10 w-full justify-center">
            
            <span className="text-[10px] md:text-[0.7vw] opacity-40 font-mono tracking-widest">------- FEATURED ARTS -------</span>
          </div>

          <div 
            ref={galleryRef} 
            className="flex gap-4 md:gap-8 px-4 md:px-10 will-change-transform items-center h-full"
            style={{ transition: "transform 0.1s cubic-bezier(0.33, 1, 0.68, 1)" }}
          >
            {featuredImages.map((image, index) => (
              <div key={image} className="flex-shrink-0 rounded-lg overflow-hidden group relative first:ml-0">
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10 rounded-[3vh] md:rounded-[5vh]"></div>
                <img 
                  src={`/imgs/featured/${image}`} 
                  alt={`artwork-${index + 1}`}
                  className="h-[50vh] md:h-[85vh] w-auto object-cover rounded-[3vh] md:rounded-[5vh] transition-transform duration-700 shadow-sm" 
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Section */}
      <div className="flex flex-col min-h-[30vh] md:min-h-[40vh] justify-center font-sans mx-4 md:mx-10 bg-white rounded-[3vh] md:rounded-[5vh] relative overflow-hidden py-8 md:py-0 mb-8">
        <div className="flex flex-col items-center px-4 text-center">
          <div className="flex gap-5 text-sm md:text-[1vw] items-center opacity-80">
            DM me at <u>@estelleo</u> in discord for commissions.
          </div>
        </div>
      </div>

      {/* Gallery Grid */}
      
      <div ref={gallerySectionRef} className="px-4 md:px-10 py-8 md:py-16">
      

        <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-2 md:gap-4 space-y-2 md:space-y-4">
          {images.map((image, index) => (
            <div 
              key={image} 
              className="break-inside-avoid group cursor-pointer"
              onClick={() => setSelectedImage(image)}
            >
              <div className="relative overflow-hidden rounded-xl md:rounded-2xl bg-white p-1 md:p-2">
                <div className="absolute inset-1 md:inset-2 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10 rounded-lg md:rounded-xl pointer-events-none"></div>
                
                <ProgressiveImage
                  src={`/imgs/${image}`}
                  placeholderColor={imageDescriptions[image]?.color}
                  blurDataUrl={imageDescriptions[image]?.blurDataUrl}
                  alt={`artwork-${index + 1}`}
                  className="w-full h-auto rounded-lg md:rounded-xl transition-transform duration-700 group-hover:scale-[1.02]"
                />

                {/* Hover overlay with number */}
                <div className="absolute bottom-2 md:bottom-4 left-2 md:left-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                  <span className="text-white text-[10px] md:text-xs font-mono bg-black/30 px-1.5 md:px-2 py-0.5 md:py-1 rounded-full backdrop-blur-sm">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Immersive Lightbox Carousel */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/90 backdrop-blur-md"
          onClick={() => setSelectedImage(null)}
        >
          {/* Background Blur of Current Image */}
          <div 
            className="absolute inset-0 z-0 opacity-20 blur-3xl scale-110 transition-all duration-700 ease-in-out"
            style={{ backgroundImage: `url(/imgs/${selectedImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          ></div>

          {/* Close button */}
          <button 
            className="absolute top-4 md:top-8 right-4 md:right-8 text-white/60 hover:text-white transition-colors text-xl md:text-2xl z-50"
            onClick={() => setSelectedImage(null)}
          >
            ✕
          </button>

          {/* Image counter */}
          <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2 z-50">
            <span className="text-white/40 text-xs md:text-sm font-mono tracking-widest">
              {String(images.indexOf(selectedImage) + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
            </span>
          </div>

          {/* Carousel Container */}
          <div className="relative w-full h-full flex items-center justify-center">
            {images.map((image, index) => {
              const currentIndex = images.indexOf(selectedImage);
              const offset = getDistanceFromCenter(index, currentIndex, images.length);
              
              // Optimization: Only render items within visible range + buffer
              if (Math.abs(offset) > 2) return null;

              // Determine styles based on offset
              let styles = "";
              
              if (offset === 0) {
                // Center - shifted left to make room for description on desktop
                // On mobile: centered
                styles = "z-30 opacity-100 scale-100 left-1/2 md:left-[40%]";
              } else if (offset === -1) {
                // Left - fixed position near left edge
                styles = "z-20 opacity-60 scale-75 blur-[3px] hover:opacity-75 cursor-pointer left-[10%] md:left-[0%] hidden md:flex";
              } else if (offset === 1) {
                // Right - fixed position near right edge
                styles = "z-20 opacity-60 scale-75 blur-[3px] hover:opacity-75 cursor-pointer left-[90%] md:left-[100%] hidden md:flex";
              } else if (offset === -2) {
                // Far Left (hidden)
                styles = "z-10 opacity-0 scale-50 left-[-20%]";
              } else if (offset === 2) {
                // Far Right (hidden)
                styles = "z-10 opacity-0 scale-50 left-[120%]";
              }

              return (
                <div
                  key={image}
                  className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] flex items-center justify-center ${styles}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (offset !== 0) setSelectedImage(image);
                  }}
                >
                  {/* Image Container */}
                  <div className="relative shadow-2xl flex flex-col items-center">
                    <img
                      src={`/imgs/${image}`}
                      alt="artwork"
                      className="max-h-[60vh] md:max-h-[80vh] max-w-[90vw] md:max-w-[45vw] object-contain rounded-xl md:rounded-2xl bg-black/20"
                    />
                    
                    {/* Description Panel */}
                    <div 
                      className={`
                        transition-all duration-500 delay-100
                        ${offset === 0 ? "opacity-100 translate-y-0 md:translate-x-0" : "opacity-0 translate-y-10 md:-translate-x-10 pointer-events-none"}
                        
                        /* Mobile Styles: Bottom Sheet */
                        fixed bottom-0 left-0 w-full p-6 pb-10
                        bg-gradient-to-t from-black via-black/90 to-transparent
                        text-center flex flex-col items-center
                        
                        /* Desktop Styles: Side Panel */
                        md:absolute md:top-1/2 md:bottom-auto md:left-full md:right-auto 
                        md:-translate-y-1/2 md:ml-8 md:w-[22vw] md:bg-none md:p-0 md:text-left md:items-start
                      `}
                    >
                      <div className="flex flex-col gap-2 md:gap-5 text-white w-full max-w-md md:max-w-none mx-auto">
                        <div className="flex flex-col gap-1 md:gap-2">
                          <span className="text-[10px] md:text-xs opacity-40 tracking-widest uppercase">Artwork</span>
                          <h2 className="text-xl md:text-2xl font-light tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
                            {getImageInfo(image).title}
                          </h2>
                        </div>
                        <div className="h-[1px] w-10 md:w-14 bg-white/20 mx-auto md:mx-0"></div>
                        <p className="text-sm md:text-base opacity-60 leading-relaxed line-clamp-4 md:line-clamp-6">
                          {getImageInfo(image).description}
                        </p>
                        {getImageInfo(image).date && (
                          <div className="flex items-center gap-2 justify-center md:justify-start">
                            <div className="w-1.5 h-1.5 rounded-full bg-pink-400/60"></div>
                            <span className="text-xs md:text-sm opacity-40">
                              {getImageInfo(image).date}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation Arrows */}
          <button
            className="absolute left-3 md:left-8 top-1/2 -translate-y-1/2 z-40 w-10 h-10 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-white/40 hover:text-white transition-all duration-200 backdrop-blur-sm border border-white/10"
            onClick={(e) => {
              e.stopPropagation();
              navigateImage("prev");
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            className="absolute right-3 md:right-8 top-1/2 -translate-y-1/2 z-40 w-10 h-10 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-white/40 hover:text-white transition-all duration-200 backdrop-blur-sm border border-white/10"
            onClick={(e) => {
              e.stopPropagation();
              navigateImage("next");
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Bottom progress bar */}
          <div className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1">
            {images.length <= 20 ? (
              images.map((img, idx) => (
                <button
                  key={img}
                  className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-all duration-300 ${
                    img === selectedImage 
                      ? "bg-white w-4 md:w-6" 
                      : "bg-white/30 hover:bg-white/50"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImage(img);
                  }}
                />
              ))
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-32 md:w-48 h-0.5 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white/60 rounded-full transition-all duration-300"
                    style={{ width: `${((images.indexOf(selectedImage) + 1) / images.length) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="min-h-[5vh]"></div>

    </div>
  );
}
