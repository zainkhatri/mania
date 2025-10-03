import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [showGlitch, setShowGlitch] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();

  // Function to handle starting the journal
  const handleStart = () => {
    navigate('/journal');
  };

  // Effect to create dynamic title style cycling
  useEffect(() => {
    const styleInterval = setInterval(() => {
      // Pick a random letter to highlight instead of cycling sequentially
      const randomIndex = Math.floor(Math.random() * 5);
      setHighlightIndex(randomIndex);
    }, 200); // Fast random cycling
    
    const glitchInterval = setInterval(() => {
      // Random glitch effect
      if (Math.random() > 0.7) {
        setShowGlitch(true);
        setTimeout(() => setShowGlitch(false), 150);
      }
    }, 1200);
    
    return () => {
      clearInterval(styleInterval);
      clearInterval(glitchInterval);
    };
  }, []);

  // Render the title with one highlighted letter at a time
  const renderTitle = () => {
    const word = "mania";
    
    return (
      <span className="title-container">
        {word.split('').map((letter, index) => (
          <span 
            key={`letter-${index}-${highlightIndex}`}
            className={index === highlightIndex 
              ? "letter-highlight" 
              : "letter-normal"}
          >
            {letter}
          </span>
        ))}
      </span>
    );
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden">
      {/* TV static background video */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0 static-bg"
      >
        <source src="/background/static.webm" type="video/webm" />
        Your browser does not support the video tag.
      </video>
      
      {/* Content overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 home-overlay">
        <h1 
          className="font-bold text-8xl md:text-[12rem] mb-4 md:mb-6 text-center mania-title text-white text-flicker"
          style={{ 
            filter: showGlitch ? 'hue-rotate(90deg) brightness(1.5)' : 'none',
            transition: 'filter 0.1s'
          }}
        >
          {renderTitle()}
        </h1>
        <p className="text-xl md:text-2xl text-white/90 mb-8 md:mb-12 text-center max-w-md backdrop-blur-md bg-black/30 p-5 rounded-2xl shadow-2xl border border-white/10">
        Create zain's journals without the pen in your hand.
      </p>
      <button
        onClick={handleStart}
          className="group flex items-center px-10 md:px-12 py-6 md:py-7 bg-gradient-to-br from-white/10 to-white/5 text-white text-2xl md:text-3xl font-bold rounded-2xl shadow-2xl hover:shadow-white/20 transition-all duration-300 active:transform active:scale-95 backdrop-blur-lg border border-white/20 hover:border-white/40 hover:from-white/15 hover:to-white/10"
      >
        <span className="mr-3 group-hover:translate-y-1 transition-transform duration-300">↓</span>
        <span>Start Journaling</span>
      </button>
      </div>
    </div>
  );
};

export default Home; 