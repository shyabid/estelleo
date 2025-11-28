"use client";

import { useRef, useEffect, useState } from "react";
import Lenis from "lenis";

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    // Initialize Lenis for smooth scrolling
    const lenis = new Lenis({
      duration: 1.20,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

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

  return (
    <div className="bg-pink-100/90">
      <div className="min-h-[5vh]"></div>
      <div className="flex min-h-[90vh] items-center justify-center mr-10 ml-10 font-sans bg-white rounded-[5vh]">

        <div className="flex items-center gap-6">
          
          {/* Image */}
          <img
            src="https://cdn.discordapp.com/emojis/1407426214548738048.webp?animated=true"
            className="w-[6vw] min-w-[40px]"
            alt=""
          />

          {/* Text column */}
          <div className="flex flex-col">
            <p className="text-[2vw] leading-none font-semibold">
              ESTELLEO
            </p>
            <p className="text-[1vw] opacity-70">
              ★ ! 2007  ·  <u>Artist</u>  ˙  ENFJ 
            </p>
          </div>

        </div>
        
      </div>
       

      {/* Horizontal scroll section */}
      <div ref={containerRef} className="h-[300vh] relative">
        <div className="sticky top-0 h-screen overflow-hidden flex flex-col justify-center">

          <div 
            ref={galleryRef} 
            className="flex gap-8 px-10 will-change-transform"
            style={{ transition: "transform 0.1s cubic-bezier(0.33, 1, 0.68, 1)" }}
          >
            <div className="flex-shrink-0 rounded-lg overflow-hidden">
              <img src="https://media.discordapp.net/attachments/1397551288576770149/1397556538515656815/Untitled66_Restored_20240702150547.png?ex=692ae774&is=692995f4&hm=a4ccf995ffd86531843161f722b7ad6826b63ac204cd830c9128ae266913ab12&=&format=webp&quality=lossless&width=728&height=728" alt="img-1"
                className="h-[85vh] w-auto object-cover rounded-[5vh]" />
            </div>
            <div className="flex-shrink-0 rounded-lg overflow-hidden">
              <img src="https://media.discordapp.net/attachments/1397551288576770149/1397556539086213190/Untitled17_20240704044344.png?ex=692ae774&is=692995f4&hm=a8a3946333f1d411a370c0d0a9edc1c3584ba5b164bb8b2099a981f942136774&=&format=webp&quality=lossless&width=728&height=728" alt="img-2"
                className="h-[85vh] w-auto object-cover rounded-[5vh]" />
            </div>
            <div className="flex-shrink-0 rounded-lg overflow-hidden">
              <img src="https://media.discordapp.net/attachments/1397551288576770149/1397556539908423813/Untitled68_Restored_20240704025758.png?ex=692ae774&is=692995f4&hm=b0135c851b1b77e7fa5f87cfe5796e8ad51fc0940c4d76de68947df7e1f61a8b&=&format=webp&quality=lossless&width=728&height=728" alt="img-3"
                className="h-[85vh] w-auto object-cover rounded-[5vh]" />
            </div>
            <div className="flex-shrink-0 rounded-lg overflow-hidden">
              <img src="https://media.discordapp.net/attachments/1397551288576770149/1397556542768939079/Untitled64_Restored.png?ex=692ae775&is=692995f5&hm=0195a0d3c377fabd14e987a71ac707a44326b373f8800da5f18515084de7f213&=&format=webp&quality=lossless&width=728&height=728" alt="img-4"
                className="h-[85vh] w-auto object-cover rounded-[5vh]" />
            </div>
            <div className="flex-shrink-0 rounded-lg overflow-hidden">
              <img src="https://media.discordapp.net/attachments/1397551288576770149/1397556546258337863/Untitled82_Restored.png?ex=692ae775&is=692995f5&hm=03de09d0b13a71d6580e0e77b163f0990b39eb77466ebc17a8e06a03a5ac4f8d&=&format=webp&quality=lossless&width=728&height=728" alt="img-5"
                className="h-[85vh] w-auto object-cover rounded-[5vh]" />
            </div>
            <div className="flex-shrink-0 rounded-lg overflow-hidden">
              <img src="https://media.discordapp.net/attachments/1397551288576770149/1397557482678910988/Untitled20.png?ex=692ae855&is=692996d5&hm=5fa3380d2fc869585172fc00540a431fa8ce49ff824307d6e42b34a2877aa8d5&=&format=webp&quality=lossless&width=728&height=728" alt="img-6"
                className="h-[85vh] w-auto object-cover rounded-[5vh]" />
            </div>
            <div className="flex-shrink-0 rounded-lg overflow-hidden">
              <img src="https://media.discordapp.net/attachments/1397551288576770149/1397560112817901609/Untitled153_2.jpg?ex=692aeac8&is=69299948&hm=348c029b86db7d4be0925274c3e50d74fe183f6c042bce12ac32139df4539f03&=&format=webp&width=728&height=728" alt="img-7"
                className="h-[85vh] w-auto object-cover rounded-[5vh]" />
            </div>
            <div className="flex-shrink-0 rounded-lg overflow-hidden">
              <img src="https://cdn.discordapp.com/attachments/1397551288576770149/1397560073928310845/Untitled125_20241223231147.png?ex=692aeabf&is=6929993f&hm=a747971c32dd21ba5f608003e230c2763b3a8e08bc5115baffade2ade3071236&=&format=webp&width=728&height=728" alt="img-8"
                className="h-[85vh] w-auto object-cover rounded-[5vh]" />
            </div>
            <div className="flex-shrink-0 rounded-lg overflow-hidden">
              <img src="https://media.discordapp.net/attachments/1397551288576770149/1397560078005047430/Untitled132_20250220125223.jpg?ex=692aeac0&is=69299940&hm=c4800dd8f603b29df0485ae3feb10bafa0cf4769428063c59580232d391d650d&=&format=webp&width=728&height=728" alt="img-9"
                className="h-[85vh] w-auto object-cover rounded-[5vh]" />
            </div>
            <div className="flex-shrink-0 rounded-lg overflow-hidden">
              <img src="https://media.discordapp.net/attachments/1397551288576770149/1399643430040244244/Untitled102.jpg?ex=692a9605&is=69294485&hm=c60d79b545874cb2d16428bafc255f6de40467cc75079c1946425988f1ae417c&=&format=webp&width=728&height=728" alt="img-10"
                className="h-[85vh] w-auto object-cover rounded-[5vh]" />
            </div>
            <div className="flex-shrink-0 rounded-lg overflow-hidden">
              <img src="https://media.discordapp.net/attachments/1397551288576770149/1397560225715720224/Untitled161_Restored_20250718180735.jpg?ex=692aeae3&is=69299963&hm=6e7e5cacedf2607eef79a6c9f4f8128a4ca007a2e361639f9c418f285de7092d&=&format=webp&width=728&height=728" alt="img-11"
                className="h-[85vh] w-auto object-cover rounded-[5vh]" />
            </div>
            <div className="flex-shrink-0 rounded-lg overflow-hidden">
              <img src="https://media.discordapp.net/attachments/1397551288576770149/1399643428681289801/Untitled28.jpg?ex=692a9605&is=69294485&hm=ab2dfa5d4245cb8e8755ce6f5d896cc356d6487a66040925788653d393d115a6&=&format=webp&width=822&height=728" alt="img-12"
                className="h-[85vh] w-auto object-cover rounded-[5vh]" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-[80vh] items-center justify-center font-sans mr-10 ml-10 bg-white rounded-[5vh]">
        <div className="flex flex-col items-center">
          
          {/* Big Name */}
          <h1 className="text-[4vw] tracking-wide">
            THANK YOU
          </h1>

          <div className="flex gap-5 text-[1vw] items-center opacity-80">
            DM me at <u>@estelleo</u> in discord for commissions.
          </div>

        </div>
      </div>

      <div className="min-h-[5vh]"></div>

    </div>
  );
}
