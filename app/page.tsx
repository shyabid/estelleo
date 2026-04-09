"use client";

import { useRef, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import Lenis from "lenis";
import ProgressiveImage from "@/components/ProgressiveImage";
import DoodlePad from "@/components/DoodlePad";
import { motion, AnimatePresence } from "framer-motion";

const SMOOTH_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type Collection = { id: string; name: string; order: number };

export default function Home() {
  const gallerySectionRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const lastScrollTime = useRef(0);
  const [featuredImages, setFeaturedImages] = useState<string[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>("__all__");
  
  // Infinite marquee state
  const marqueeRef = useRef<HTMLDivElement>(null);
  const marqueeInnerRef = useRef<HTMLDivElement>(null);
  const scrollVelocity = useRef(0);
  const currentTranslate = useRef(0);
  const animationFrameId = useRef<number>(0);
  const baseSpeed = 0.5; // Base scroll speed
  const velocityMultiplier = 3; // How much scroll velocity affects speed

  const [images, setImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  // Shared-element morph: while non-null, the matching thumb and the
  // lightbox center image share a layoutId, producing a smooth open animation.
  const [morphId, setMorphId] = useState<string | null>(null);
  // Hero swipe carousel: 0 = intro, 1 = doodle pad.
  const [heroPanel, setHeroPanel] = useState<0 | 1>(0);
  const [imageDescriptions, setImageDescriptions] = useState<Record<string, {
    title?: string;
    description: string;
    date?: string;
    color?: string;
    blurDataUrl?: string;
    collections?: string[];
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

  // Fetch collections
  useEffect(() => {
    fetch("/api/collections")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCollections([...data].sort((a, b) => a.order - b.order));
        }
      })
      .catch(() => setCollections([]));
  }, []);

  // When filter changes, if current scroll position would leave us below the
  // new (shorter) page, smoothly scroll up to the last valid position.
  useEffect(() => {
    // Wait for layout animations to settle before measuring
    const checkAndScroll = () => {
      const docHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const maxScroll = Math.max(0, docHeight - viewportHeight);
      const currentScroll = window.scrollY;

      if (currentScroll > maxScroll - 8) {
        lenisRef.current?.scrollTo(maxScroll, {
          duration: 1.1,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        });
      }
    };

    // Measure a few times during the layout animation so we follow the
    // content shrinking instead of snapping at the end.
    const raf1 = requestAnimationFrame(checkAndScroll);
    const t1 = setTimeout(checkAndScroll, 250);
    const t2 = setTimeout(checkAndScroll, 550);
    const t3 = setTimeout(checkAndScroll, 850);
    return () => {
      cancelAnimationFrame(raf1);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [activeFilter]);

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

  // Infinite marquee animation
  useEffect(() => {
    if (!marqueeInnerRef.current || featuredImages.length === 0) return;

    const marqueeInner = marqueeInnerRef.current;
    let lastTime = performance.now();
    
    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 16; // Normalize to ~60fps
      lastTime = currentTime;
      
      // Calculate speed based on base speed + scroll velocity
      const speed = (baseSpeed + Math.abs(scrollVelocity.current) * velocityMultiplier) * deltaTime;
      
      // Update position
      currentTranslate.current -= speed;
      
      // Get the width of one set of images (half the container since we duplicate)
      const singleSetWidth = marqueeInner.scrollWidth / 2;
      
      // Reset when we've scrolled past one full set
      if (Math.abs(currentTranslate.current) >= singleSetWidth) {
        currentTranslate.current = 0;
      }
      
      marqueeInner.style.transform = `translateX(${currentTranslate.current}px)`;
      
      // Decay velocity
      scrollVelocity.current *= 0.95;
      
      animationFrameId.current = requestAnimationFrame(animate);
    };
    
    animationFrameId.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [featuredImages]);

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

    // Handle scroll for velocity tracking
    const handleScroll = ({ velocity }: { velocity: number }) => {
      // Update scroll velocity for marquee effect
      scrollVelocity.current = velocity;
    };

    lenis.on("scroll", handleScroll);

    return () => {
      lenis.destroy();
    };
  }, []);

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

  // Open the lightbox with a shared-element morph from the clicked thumb.
  // flushSync forces the thumb to render + register with framer's layoutId
  // system *before* the lightbox mounts. Then setSelectedImage flips the
  // thumb's layoutId back off and mounts the lightbox with the matching id —
  // framer treats that as a source→target shared-element transition.
  const openImage = (img: string) => {
    flushSync(() => {
      setMorphId(img);
    });
    setSelectedImage(img);
    window.setTimeout(() => setMorphId(null), 800);
  };

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
    
    <div className="bg-pink-100/90 relative min-h-screen">
      {/* Main Content */}
      <div className="relative z-10">
      <div className="min-h-[2vh] md:min-h-[5vh]"></div>
      <div className="relative min-h-[80vh] md:min-h-[90vh] mx-4 md:mx-10 font-sans bg-white rounded-[3vh] md:rounded-[5vh] overflow-hidden">
        {/* Swipeable two-panel carousel: intro → doodle pad */}
        <motion.div
          className="flex w-[200%] h-full absolute inset-0"
          animate={{ x: heroPanel === 0 ? "0%" : "-50%" }}
          transition={{ duration: 0.65, ease: SMOOTH_EASE }}
        >
          {/* Panel 0 — Intro */}
          <div className="w-1/2 shrink-0 min-h-[80vh] md:min-h-[90vh] flex items-center justify-center relative">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 text-center md:text-left pointer-events-none">
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

            {/* Top-right doodle hint (mirrors the back button on panel 1) */}
            <button
              onClick={() => setHeroPanel(1)}
              className="absolute top-4 md:top-8 right-6 md:right-12 flex items-center gap-1 text-black/40 hover:text-black/80 transition-colors cursor-pointer"
              aria-label="open doodle pad"
            >
              <span className="text-[9px] md:text-[10px] font-mono tracking-[0.3em] uppercase">
                doodle
              </span>
              <motion.span
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                className="text-lg md:text-xl leading-none inline-block"
              >
                →
              </motion.span>
            </button>
          </div>

          {/* Panel 1 — Doodle Pad */}
          <div className="w-1/2 shrink-0 min-h-[80vh] md:min-h-[90vh] relative">
            <DoodlePad
              active={heroPanel === 1}
              onBack={() => setHeroPanel(0)}
            />
          </div>
        </motion.div>

        {/* Panel dots */}
        <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2 pointer-events-none">
          <span
            className={`h-1.5 rounded-full transition-all ${
              heroPanel === 0 ? "w-6 bg-black/60" : "w-1.5 bg-black/20"
            }`}
          />
          <span
            className={`h-1.5 rounded-full transition-all ${
              heroPanel === 1 ? "w-6 bg-black/60" : "w-1.5 bg-black/20"
            }`}
          />
        </div>
      </div>

      {/* Infinite Marquee Section */}
      <div className="h-screen relative overflow-hidden flex flex-col justify-center">
        <div className="absolute top-8 md:top-8 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10 w-full justify-center">
          <span className="text-[10px] md:text-[0.7vw] opacity-40 font-mono tracking-widest">------- FEATURED ARTS -------</span>
        </div>

        <div 
          ref={marqueeRef}
          className="overflow-hidden w-full"
        >
          <div 
            ref={marqueeInnerRef}
            className="flex gap-4 md:gap-8 will-change-transform items-center"
            style={{ width: 'fit-content' }}
          >
            {/* First set of images */}
            {featuredImages.map((image, index) => (
              <div key={`first-${image}`} className="flex-shrink-0 rounded-lg overflow-hidden group relative">
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10 rounded-[3vh] md:rounded-[5vh]"></div>
                <img 
                  src={`/imgs/featured/${image}`} 
                  alt={`artwork-${index + 1}`}
                  className="h-[50vh] md:h-[75vh] w-auto object-cover rounded-[3vh] md:rounded-[5vh] transition-transform duration-700 shadow-sm" 
                  draggable={false}
                />
              </div>
            ))}
            {/* Duplicate set for infinite loop */}
            {featuredImages.map((image, index) => (
              <div key={`second-${image}`} className="flex-shrink-0 rounded-lg overflow-hidden group relative">
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10 rounded-[3vh] md:rounded-[5vh]"></div>
                <img 
                  src={`/imgs/featured/${image}`} 
                  alt={`artwork-${index + 1}`}
                  className="h-[50vh] md:h-[75vh] w-auto object-cover rounded-[3vh] md:rounded-[5vh] transition-transform duration-700 shadow-sm" 
                  draggable={false}
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

        {/* Collection filter pills */}
        {collections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: SMOOTH_EASE }}
            className="flex flex-wrap justify-center gap-2 md:gap-3 mb-6 md:mb-10"
          >
            <CollectionPill
              label="All"
              active={activeFilter === "__all__"}
              onClick={() => setActiveFilter("__all__")}
            />
            {collections.map((c) => (
              <CollectionPill
                key={c.id}
                label={c.name}
                active={activeFilter === c.id}
                onClick={() => setActiveFilter(c.id)}
              />
            ))}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
        <motion.div
          key={activeFilter}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.55, ease: SMOOTH_EASE }}
          className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-2 md:gap-4 space-y-2 md:space-y-4"
        >
          {images
            .filter((image) => {
              if (activeFilter === "__all__") return true;
              const imgColls = imageDescriptions[image]?.collections || [];
              return imgColls.includes(activeFilter);
            })
            .map((image, index) => (
            <motion.div
              key={image}
              className="break-inside-avoid cursor-pointer"
              onClick={() => openImage(image)}
              whileTap={{ scale: 0.975 }}
              transition={{ duration: 0.35, ease: SMOOTH_EASE }}
            >
              <motion.div
                layoutId={
                  morphId === image && selectedImage !== image
                    ? `morph-${image}`
                    : undefined
                }
                transition={{ duration: 0.6, ease: SMOOTH_EASE }}
                className="relative overflow-hidden rounded-xl md:rounded-2xl p-1 md:p-2 bg-white"
                style={{ opacity: selectedImage === image ? 0 : 1 }}
              >
                <ProgressiveImage
                  src={`/imgs/${image}`}
                  placeholderColor={imageDescriptions[image]?.color}
                  blurDataUrl={imageDescriptions[image]?.blurDataUrl}
                  alt={`artwork-${index + 1}`}
                  className="w-full h-auto rounded-lg md:rounded-xl"
                />
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
        </AnimatePresence>
      </div>

      {/* Immersive Lightbox Carousel */}
      <AnimatePresence>
      {selectedImage && (
        <motion.div
          key="lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: SMOOTH_EASE }}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/90 backdrop-blur-md"
          onClick={() => setSelectedImage(null)}
        >
          {/* Background Blur of Current Image - crossfades on change */}
          <AnimatePresence mode="sync">
            <motion.div
              key={selectedImage}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: SMOOTH_EASE }}
              className="absolute inset-0 z-0 blur-3xl scale-110 pointer-events-none"
              style={{ backgroundImage: `url(/imgs/${selectedImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
          </AnimatePresence>

          {/* Close button */}
          <motion.button
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5, delay: 0.15, ease: SMOOTH_EASE }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            className="absolute top-4 md:top-8 right-4 md:right-8 text-white/60 hover:text-white transition-colors text-xl md:text-2xl z-50"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedImage(null);
            }}
          >
            ✕
          </motion.button>

          {/* Image counter */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5, delay: 0.15, ease: SMOOTH_EASE }}
            className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2 z-50"
          >
            <span className="text-white/40 text-xs md:text-sm font-mono tracking-widest tabular-nums">
              {String(images.indexOf(selectedImage) + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
            </span>
          </motion.div>

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
                styles = "z-30 opacity-100 scale-100 left-1/2 md:left-[40%]";
              } else if (offset === -1) {
                styles = "z-20 opacity-60 scale-75 blur-[3px] hover:opacity-75 cursor-pointer left-[0%] md:left-[0%] hidden md:flex";
              } else if (offset === 1) {
                styles = "z-20 opacity-60 scale-75 blur-[3px] hover:opacity-75 cursor-pointer left-[100%] md:left-[100%] hidden md:flex";
              } else if (offset === -2) {
                styles = "z-10 opacity-0 scale-50 left-[-20%] pointer-events-none";
              } else if (offset === 2) {
                styles = "z-10 opacity-0 scale-50 left-[120%] pointer-events-none";
              }

              const isMorphTarget = offset === 0 && morphId === image;
              return (
                <div
                  key={image}
                  className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] flex items-center justify-center will-change-transform ${styles}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (offset !== 0) setSelectedImage(image);
                  }}
                >
                  {/* Image Container */}
                  <motion.div
                    layoutId={isMorphTarget ? `morph-${image}` : undefined}
                    transition={{ duration: 0.6, ease: SMOOTH_EASE }}
                    className="relative shadow-2xl flex flex-col items-center"
                  >
                    <img
                      src={`/imgs/${image}`}
                      alt="artwork"
                      className="max-h-[60vh] md:max-h-[80vh] max-w-[90vw] md:max-w-[45vw] object-contain rounded-xl md:rounded-2xl bg-black/20"
                      draggable={false}
                    />
                  </motion.div>
                </div>
              );
            })}
          </div>

          {/* Invisible side click zones — always clickable, even mid-animation */}
          <button
            aria-label="previous"
            className="hidden md:block absolute left-0 top-0 h-full w-[20%] z-[35] cursor-pointer bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              navigateImage("prev");
            }}
          />
          <button
            aria-label="next"
            className="hidden md:block absolute right-0 top-0 h-full w-[20%] z-[35] cursor-pointer bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              navigateImage("next");
            }}
          />

          {/* Description Panel - crossfades on image change */}
          <div className="pointer-events-none">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedImage}
                initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
                transition={{ duration: 0.55, ease: SMOOTH_EASE }}
                className="
                  fixed bottom-0 left-0 w-full p-6 pb-10
                  bg-gradient-to-t from-black via-black/90 to-transparent
                  text-center flex flex-col items-center z-40
                  md:absolute md:top-1/2 md:bottom-auto md:left-[calc(40%+22vw)] md:right-auto
                  md:-translate-y-1/2 md:ml-2 md:w-[22vw] md:bg-none md:p-0 md:text-left md:items-start
                "
              >
                <div className="flex flex-col gap-2 md:gap-5 text-white w-full max-w-md md:max-w-none mx-auto">
                  <div className="flex flex-col gap-1 md:gap-2">
                    <span className="text-[10px] md:text-xs opacity-40 tracking-widest uppercase">Artwork</span>
                    <h2 className="text-xl md:text-2xl font-light tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
                      {getImageInfo(selectedImage).title}
                    </h2>
                  </div>
                  <div className="h-[1px] w-10 md:w-14 bg-white/20 mx-auto md:mx-0"></div>
                  <p className="text-sm md:text-base opacity-60 leading-relaxed line-clamp-4 md:line-clamp-6 w-80 max-w-full">
                    {getImageInfo(selectedImage).description}
                  </p>
                  {getImageInfo(selectedImage).date && (
                    <div className="flex items-center gap-2 justify-center md:justify-start">
                      <div className="w-1.5 h-1.5 rounded-full bg-pink-400/60"></div>
                      <span className="text-xs md:text-sm opacity-40">
                        {getImageInfo(selectedImage).date}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Arrows */}
          {/* Bottom progress */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.55, delay: 0.2, ease: SMOOTH_EASE }}
            className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1"
          >
            {images.length <= 20 ? (
              images.map((img) => (
                <motion.button
                  key={img}
                  whileTap={{ scale: 0.85 }}
                  className="h-1.5 md:h-2 rounded-full"
                  animate={{
                    width: img === selectedImage ? (typeof window !== "undefined" && window.innerWidth >= 768 ? 24 : 16) : (typeof window !== "undefined" && window.innerWidth >= 768 ? 8 : 6),
                    backgroundColor: img === selectedImage ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.3)",
                  }}
                  transition={{ duration: 0.55, ease: SMOOTH_EASE }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImage(img);
                  }}
                />
              ))
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-32 md:w-48 h-0.5 bg-white/20 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-white/70 rounded-full"
                    animate={{ width: `${((images.indexOf(selectedImage) + 1) / images.length) * 100}%` }}
                    transition={{ duration: 0.7, ease: SMOOTH_EASE }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <div className="min-h-[5vh]"></div>
      </div>{/* End of Main Content z-10 wrapper */}
    </div>
  );
}

function CollectionPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      className="relative text-[10px] md:text-xs uppercase tracking-[0.2em] px-4 md:px-5 py-2 md:py-2.5 rounded-full text-black"
    >
      {active && (
        <motion.span
          layoutId="home-filter-active"
          className="absolute inset-0 bg-white rounded-full"
          transition={{ duration: 0.55, ease: SMOOTH_EASE }}
        />
      )}
      <span className="relative font-medium">{label}</span>
    </motion.button>
  );
}
