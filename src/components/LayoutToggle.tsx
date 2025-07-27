import React from 'react';

interface LayoutToggleProps {
  layoutMode: 'standard' | 'mirrored' | 'freeflow';
  setLayoutMode: (mode: 'standard' | 'mirrored' | 'freeflow') => void;
}

const LayoutToggle: React.FC<LayoutToggleProps> = ({ layoutMode, setLayoutMode }) => {
  // Detect mobile device
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           window.innerWidth <= 768;
  };
  
  return (
    <div className="space-y-1 md:space-y-2">
      <label className="block text-sm md:text-lg font-medium text-white flex items-center gap-1 md:gap-2">
        <svg width="14" height="14" className="md:w-[18px] md:h-[18px] fill-none stroke-currentColor viewBox-0 0 24 24 text-gray-300" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
        </svg>
        <span>Layout Style</span>
      </label>
      
      {/* Freeflow - Horizontal bar at top */}
      <div
        onClick={() => setLayoutMode('freeflow')}
        className={`relative w-full h-12 md:h-16 border-2 rounded-lg cursor-pointer transition-all duration-200 flex items-center justify-between p-2 md:p-3 ${
          layoutMode === 'freeflow' 
            ? 'border-white bg-black/60 shadow-md' 
            : 'border-gray-600 bg-black/40 hover:border-gray-400'
        }`}
      >
        <div className="flex items-center gap-2 md:gap-3 w-full">
          <div className="w-10 h-8 md:w-14 md:h-10 bg-[#1a1a1a]/70 rounded-md p-1 md:p-2 flex flex-col space-y-[1px]">
            {/* Text lines flowing naturally */}
            <div className="w-full h-1/3 flex flex-col justify-center space-y-[1px]">
              <div className="h-[2px] w-full bg-gray-500 rounded-sm"></div>
              <div className="h-[2px] w-3/4 bg-gray-500 rounded-sm"></div>
            </div>
            <div className="w-full h-1/3 flex flex-col justify-center space-y-[1px]">
              <div className="h-[2px] w-full bg-gray-500 rounded-sm"></div>
              <div className="h-[2px] w-5/6 bg-gray-500 rounded-sm"></div>
            </div>
            <div className="w-full h-1/3 flex flex-col justify-center space-y-[1px]">
              <div className="h-[2px] w-full bg-gray-500 rounded-sm"></div>
              <div className="h-[2px] w-2/3 bg-gray-500 rounded-sm"></div>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-sm md:text-base font-medium text-white">
              Freeflow
              {isMobile() && (
                <span className="ml-1 text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full">
                  Default
                </span>
              )}
            </span>
            <span className="text-xs text-gray-400">The journal is yours.</span>
          </div>
        </div>
        {layoutMode === 'freeflow' && (
          <div className="absolute -top-1 -right-1 bg-white rounded-full p-1">
            <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
        )}
      </div>
      
      {/* Style 1 and Style 2 - Compact Squares below */}
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        <div
          onClick={() => setLayoutMode('standard')}
          className={`relative aspect-square border-2 rounded-lg cursor-pointer transition-all duration-200 flex flex-col items-center justify-center p-2 ${
            layoutMode === 'standard' 
              ? 'border-white bg-black/60 shadow-md' 
              : 'border-gray-600 bg-black/40 hover:border-gray-400'
          }`}
        >
          <div className="flex flex-col items-center gap-2 w-full h-full">
            <div className="w-3/4 aspect-square bg-[#1a1a1a]/70 rounded-md p-1 flex flex-col space-y-[1px]">
              {/* Top row */}
              <div className="w-full h-1/4 flex items-center justify-center">
                <div className="w-full h-1 bg-gray-500 rounded-full"></div>
              </div>
              {/* Middle row - Image left, text right */}
              <div className="flex w-full h-1/4">
                <div className="w-1/2 h-full bg-gray-400 rounded-sm"></div>
                <div className="w-1/2 h-full pl-[2px] flex flex-col justify-center space-y-[1px]">
                  <div className="h-[2px] w-full bg-gray-500 rounded-sm"></div>
                  <div className="h-[2px] w-3/4 bg-gray-500 rounded-sm"></div>
                </div>
              </div>
              {/* Middle row - Text left, image right */}
              <div className="flex w-full h-1/4">
                <div className="w-1/2 h-full flex flex-col justify-center space-y-[1px]">
                  <div className="h-[2px] w-full bg-gray-500 rounded-sm"></div>
                  <div className="h-[2px] w-3/4 bg-gray-500 rounded-sm"></div>
                </div>
                <div className="w-1/2 h-full pl-[2px] bg-gray-400 rounded-sm"></div>
              </div>
              {/* Bottom row - Image left, text right */}
              <div className="flex w-full h-1/4">
                <div className="w-1/2 h-full bg-gray-400 rounded-sm"></div>
                <div className="w-1/2 h-full pl-[2px] flex flex-col justify-center space-y-[1px]">
                  <div className="h-[2px] w-full bg-gray-500 rounded-sm"></div>
                  <div className="h-[2px] w-3/4 bg-gray-500 rounded-sm"></div>
                </div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs font-medium text-white">Style 1</div>
              <div className="text-[8px] text-gray-400">Left</div>
            </div>
          </div>
          {layoutMode === 'standard' && (
            <div className="absolute -top-1 -right-1 bg-white rounded-full p-1">
              <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
          )}
        </div>

        <div
          onClick={() => setLayoutMode('mirrored')}
          className={`relative aspect-square border-2 rounded-lg cursor-pointer transition-all duration-200 flex flex-col items-center justify-center p-2 ${
            layoutMode === 'mirrored' 
              ? 'border-white bg-black/60 shadow-md' 
              : 'border-gray-600 bg-black/40 hover:border-gray-400'
          }`}
        >
          <div className="flex flex-col items-center gap-2 w-full h-full">
            <div className="w-3/4 aspect-square bg-[#1a1a1a]/70 rounded-md p-1 flex flex-col space-y-[1px]">
              {/* Top row */}
              <div className="w-full h-1/4 flex items-center justify-center">
                <div className="w-full h-1 bg-gray-500 rounded-full"></div>
              </div>
              {/* Middle row - Text left, image right */}
              <div className="flex w-full h-1/4">
                <div className="w-1/2 h-full flex flex-col justify-center space-y-[1px]">
                  <div className="h-[2px] w-full bg-gray-500 rounded-sm"></div>
                  <div className="h-[2px] w-3/4 bg-gray-500 rounded-sm"></div>
                </div>
                <div className="w-1/2 h-full pl-[2px] bg-gray-400 rounded-sm"></div>
              </div>
              {/* Middle row - Image left, text right */}
              <div className="flex w-full h-1/4">
                <div className="w-1/2 h-full bg-gray-400 rounded-sm"></div>
                <div className="w-1/2 h-full pl-[2px] flex flex-col justify-center space-y-[1px]">
                  <div className="h-[2px] w-full bg-gray-500 rounded-sm"></div>
                  <div className="h-[2px] w-3/4 bg-gray-500 rounded-sm"></div>
                </div>
              </div>
              {/* Bottom row - Text left, image right */}
              <div className="flex w-full h-1/4">
                <div className="w-1/2 h-full flex flex-col justify-center space-y-[1px]">
                  <div className="h-[2px] w-full bg-gray-500 rounded-sm"></div>
                  <div className="h-[2px] w-3/4 bg-gray-500 rounded-sm"></div>
                </div>
                <div className="w-1/2 h-full pl-[2px] bg-gray-400 rounded-sm"></div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs font-medium text-white">Style 2</div>
              <div className="text-[8px] text-gray-400">Right</div>
            </div>
          </div>
          {layoutMode === 'mirrored' && (
            <div className="absolute -top-1 -right-1 bg-white rounded-full p-1">
              <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LayoutToggle; 