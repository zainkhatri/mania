import React from 'react';

interface LayoutToggleProps {
  layoutMode: 'standard' | 'mirrored' | 'freeflow';
  setLayoutMode: (mode: 'standard' | 'mirrored' | 'freeflow') => void;
}

const LayoutToggle: React.FC<LayoutToggleProps> = ({ layoutMode, setLayoutMode }) => {
  
  return (
    <div className="space-y-2 w-full">
      
      {/* Freeflow - Horizontal bar at top */}
      <div
        onClick={() => setLayoutMode('freeflow')}
        className={`relative w-full h-14 border-2 rounded-xl cursor-pointer transition-all duration-200 flex items-center p-3 ${
          layoutMode === 'freeflow'
            ? 'border-white bg-white/5 shadow-lg'
            : 'border-gray-700 bg-black/30 hover:border-gray-500 hover:bg-white/5'
        }`}
      >
        <div className="flex items-center gap-3 w-full">
          <div className="w-12 h-9 bg-white/10 rounded-lg p-2 flex flex-col justify-center space-y-1">
            {/* Text lines flowing naturally */}
            <div className="h-[2px] w-full bg-gray-400 rounded-sm"></div>
            <div className="h-[2px] w-3/4 bg-gray-400 rounded-sm"></div>
            <div className="h-[2px] w-full bg-gray-400 rounded-sm"></div>
            <div className="h-[2px] w-5/6 bg-gray-400 rounded-sm"></div>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold text-white">
              Freeflow
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
      <div className="grid grid-cols-2 gap-3">
        <div
          onClick={() => setLayoutMode('standard')}
          className={`relative border-2 rounded-xl cursor-pointer transition-all duration-200 flex flex-col items-center justify-center p-3 ${
            layoutMode === 'standard'
              ? 'border-white bg-white/5 shadow-lg'
              : 'border-gray-700 bg-black/30 hover:border-gray-500 hover:bg-white/5'
          }`}
        >
          <div className="flex flex-col items-center gap-2 w-full">
            <div className="w-16 h-16 bg-white/10 rounded-lg p-2 flex flex-col space-y-1">
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
              <div className="text-sm font-semibold text-white">Style 1</div>
              <div className="text-xs text-gray-400">Left</div>
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
          className={`relative border-2 rounded-xl cursor-pointer transition-all duration-200 flex flex-col items-center justify-center p-3 ${
            layoutMode === 'mirrored'
              ? 'border-white bg-white/5 shadow-lg'
              : 'border-gray-700 bg-black/30 hover:border-gray-500 hover:bg-white/5'
          }`}
        >
          <div className="flex flex-col items-center gap-2 w-full">
            <div className="w-16 h-16 bg-white/10 rounded-lg p-2 flex flex-col space-y-1">
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
              <div className="text-sm font-semibold text-white">Style 2</div>
              <div className="text-xs text-gray-400">Right</div>
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