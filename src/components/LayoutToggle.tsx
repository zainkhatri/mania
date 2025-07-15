import React from 'react';

interface LayoutToggleProps {
  layoutMode: 'standard' | 'mirrored';
  setLayoutMode: (mode: 'standard' | 'mirrored') => void;
}

const LayoutToggle: React.FC<LayoutToggleProps> = ({ layoutMode, setLayoutMode }) => {
  return (
    <div className="space-y-2">
      <label className="block text-lg font-medium text-white flex items-center gap-2">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-gray-300">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
        </svg>
        <span>Layout Style</span>
      </label>
      
      <div className="grid grid-cols-2 gap-4">
        <div
          onClick={() => setLayoutMode('standard')}
          className={`relative aspect-square border-2 rounded-lg cursor-pointer transition-all duration-200 flex flex-col items-center justify-between p-4 ${
            layoutMode === 'standard' 
              ? 'border-white bg-black/60 shadow-md' 
              : 'border-gray-600 bg-black/40 hover:border-gray-400'
          }`}
        >
          <div className="flex flex-col items-center gap-2 w-full h-full">
            <div className="w-full aspect-square bg-[#1a1a1a]/70 rounded-md p-2 flex flex-col space-y-1">
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
            <span className="text-sm font-medium text-white">Style 1</span>
            <span className="text-xs text-gray-400">Images on left</span>
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
          className={`relative aspect-square border-2 rounded-lg cursor-pointer transition-all duration-200 flex flex-col items-center justify-between p-4 ${
            layoutMode === 'mirrored' 
              ? 'border-white bg-black/60 shadow-md' 
              : 'border-gray-600 bg-black/40 hover:border-gray-400'
          }`}
        >
          <div className="flex flex-col items-center gap-2 w-full h-full">
            <div className="w-full aspect-square bg-[#1a1a1a]/70 rounded-md p-2 flex flex-col space-y-1">
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
            <span className="text-sm font-medium text-white">Style 2</span>
            <span className="text-xs text-gray-400">Images on right</span>
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