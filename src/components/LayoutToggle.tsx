import React from 'react';

interface LayoutToggleProps {
  layoutMode: 'standard' | 'mirrored';
  setLayoutMode: (mode: 'standard' | 'mirrored') => void;
}

const LayoutToggle: React.FC<LayoutToggleProps> = ({ layoutMode, setLayoutMode }) => {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-[#1a1a1a] flex items-center gap-2">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-[#4a4a4a]">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
        </svg>
        <span>Layout Style</span>
      </label>
      
      <div className="flex flex-wrap gap-4">
        <div
          onClick={() => setLayoutMode('standard')}
          className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
            layoutMode === 'standard' 
              ? 'border-[#1a1a1a] bg-white shadow-md' 
              : 'border-[#d1cdc0] bg-white/50 hover:border-[#a7a49a]'
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-full h-24 bg-[#f5f2e9] rounded-md p-2 flex flex-col space-y-1">
              {/* Top row */}
              <div className="w-full h-1/4 flex items-center justify-center">
                <div className="w-full h-2 bg-gray-300 rounded-full"></div>
              </div>
              {/* Middle row - Image left, text right */}
              <div className="flex w-full h-1/4">
                <div className="w-1/2 h-full bg-gray-400 rounded-sm"></div>
                <div className="w-1/2 h-full pl-1 flex flex-col justify-center space-y-[2px]">
                  <div className="h-1 w-full bg-gray-300 rounded-sm"></div>
                  <div className="h-1 w-3/4 bg-gray-300 rounded-sm"></div>
                </div>
              </div>
              {/* Middle row - Text left, image right */}
              <div className="flex w-full h-1/4">
                <div className="w-1/2 h-full flex flex-col justify-center space-y-[2px]">
                  <div className="h-1 w-full bg-gray-300 rounded-sm"></div>
                  <div className="h-1 w-3/4 bg-gray-300 rounded-sm"></div>
                </div>
                <div className="w-1/2 h-full pl-1 bg-gray-400 rounded-sm"></div>
              </div>
              {/* Bottom row - Image left, text right */}
              <div className="flex w-full h-1/4">
                <div className="w-1/2 h-full bg-gray-400 rounded-sm"></div>
                <div className="w-1/2 h-full pl-1 flex flex-col justify-center space-y-[2px]">
                  <div className="h-1 w-full bg-gray-300 rounded-sm"></div>
                  <div className="h-1 w-3/4 bg-gray-300 rounded-sm"></div>
                </div>
              </div>
            </div>
            <span className="text-sm font-medium">Style 1</span>
            <span className="text-xs text-gray-500">Images on left</span>
          </div>
          {layoutMode === 'standard' && (
            <div className="absolute -top-2 -right-2 bg-[#1a1a1a] rounded-full p-1">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
          )}
        </div>

        <div
          onClick={() => setLayoutMode('mirrored')}
          className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
            layoutMode === 'mirrored' 
              ? 'border-[#1a1a1a] bg-white shadow-md' 
              : 'border-[#d1cdc0] bg-white/50 hover:border-[#a7a49a]'
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-full h-24 bg-[#f5f2e9] rounded-md p-2 flex flex-col space-y-1">
              {/* Top row */}
              <div className="w-full h-1/4 flex items-center justify-center">
                <div className="w-full h-2 bg-gray-300 rounded-full"></div>
              </div>
              {/* Middle row - Text left, image right */}
              <div className="flex w-full h-1/4">
                <div className="w-1/2 h-full flex flex-col justify-center space-y-[2px]">
                  <div className="h-1 w-full bg-gray-300 rounded-sm"></div>
                  <div className="h-1 w-3/4 bg-gray-300 rounded-sm"></div>
                </div>
                <div className="w-1/2 h-full pl-1 bg-gray-400 rounded-sm"></div>
              </div>
              {/* Middle row - Image left, text right */}
              <div className="flex w-full h-1/4">
                <div className="w-1/2 h-full bg-gray-400 rounded-sm"></div>
                <div className="w-1/2 h-full pl-1 flex flex-col justify-center space-y-[2px]">
                  <div className="h-1 w-full bg-gray-300 rounded-sm"></div>
                  <div className="h-1 w-3/4 bg-gray-300 rounded-sm"></div>
                </div>
              </div>
              {/* Bottom row - Text left, image right */}
              <div className="flex w-full h-1/4">
                <div className="w-1/2 h-full flex flex-col justify-center space-y-[2px]">
                  <div className="h-1 w-full bg-gray-300 rounded-sm"></div>
                  <div className="h-1 w-3/4 bg-gray-300 rounded-sm"></div>
                </div>
                <div className="w-1/2 h-full pl-1 bg-gray-400 rounded-sm"></div>
              </div>
            </div>
            <span className="text-sm font-medium">Style 2</span>
            <span className="text-xs text-gray-500">Images on right</span>
          </div>
          {layoutMode === 'mirrored' && (
            <div className="absolute -top-2 -right-2 bg-[#1a1a1a] rounded-full p-1">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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