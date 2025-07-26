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
        <p className="text-xl md:text-2xl text-white mb-8 md:mb-12 text-center max-w-md backdrop-blur-sm bg-black bg-opacity-20 p-4 rounded-lg">
        Create zain's journals without the pen in your hand.
      </p>
      <button
        onClick={handleStart}
          className="flex items-center px-8 md:px-10 py-5 md:py-6 bg-black bg-opacity-70 text-white text-2xl md:text-3xl font-bold rounded-2xl shadow-md hover:bg-opacity-90 transition-all active:transform active:scale-95 backdrop-blur-sm border border-white border-opacity-20"
      >
        <span className="mr-3">↓</span> Start Journaling
      </button>
      </div>
    </div>
  );
};

export default Home; 