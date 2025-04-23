import React, { useRef, useEffect, useState } from 'react';

// Define regions for text and images
interface Region {
  id: string;
  type: 'text' | 'image' | 'date' | 'location';
  x: number;
  y: number;
  width: number;
  height: number;
}

interface JournalTemplateEditorProps {
  templateUrl: string;
  onSaveRegions: (regions: Region[]) => void;
  initialRegions?: Region[];
}

const JournalTemplateEditor: React.FC<JournalTemplateEditorProps> = ({
  templateUrl,
  onSaveRegions,
  initialRegions = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [templateImage, setTemplateImage] = useState<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [regions, setRegions] = useState<Region[]>(initialRegions);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [editorMode, setEditorMode] = useState<'select' | 'create'>('select');
  const [newRegionType, setNewRegionType] = useState<'text' | 'image' | 'date' | 'location'>('text');

  // Load template image
  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);
    const loadTemplate = async () => {
      const template = new Image();
      template.crossOrigin = 'anonymous';
      
      const templatePromise = new Promise<HTMLImageElement | null>((resolve) => {
        template.onload = () => resolve(template);
        template.onerror = () => {
          console.error('Failed to load template image');
          setLoadError('Failed to load template image. Please check the URL and try again.');
          resolve(null);
        };
        template.src = templateUrl;
      });
      
      const loadedTemplate = await templatePromise;
      setTemplateImage(loadedTemplate);
      setIsLoading(false);
    };
    
    loadTemplate();
  }, [templateUrl]);

  // Draw the canvas with template and regions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isLoading || !templateImage) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size to match template
    canvas.width = templateImage.width;
    canvas.height = templateImage.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw template background
    ctx.drawImage(templateImage, 0, 0, canvas.width, canvas.height);
    
    // Draw regions
    regions.forEach(region => {
      ctx.fillStyle = region.type === 'text' 
        ? 'rgba(0, 100, 255, 0.2)' 
        : region.type === 'image' 
          ? 'rgba(255, 100, 0, 0.2)'
          : region.type === 'date'
            ? 'rgba(0, 255, 100, 0.2)'
            : 'rgba(255, 0, 255, 0.2)';
      
      ctx.strokeStyle = region.id === activeRegion 
        ? '#ff0000' 
        : region.type === 'text' 
          ? '#0064ff' 
          : region.type === 'image' 
            ? '#ff6400'
            : region.type === 'date'
              ? '#00ff64'
              : '#ff00ff';
      
      ctx.lineWidth = region.id === activeRegion ? 3 : 2;
      
      ctx.fillRect(region.x, region.y, region.width, region.height);
      ctx.strokeRect(region.x, region.y, region.width, region.height);
      
      // Draw label
      ctx.fillStyle = '#000000';
      ctx.font = '16px Arial';
      ctx.fillText(region.type, region.x + 5, region.y + 20);
      
      // Draw resize handles if active
      if (region.id === activeRegion) {
        const handleSize = 10;
        ctx.fillStyle = '#ff0000';
        
        // Top-left handle
        ctx.fillRect(region.x - handleSize/2, region.y - handleSize/2, handleSize, handleSize);
        
        // Top-right handle
        ctx.fillRect(region.x + region.width - handleSize/2, region.y - handleSize/2, handleSize, handleSize);
        
        // Bottom-left handle
        ctx.fillRect(region.x - handleSize/2, region.y + region.height - handleSize/2, handleSize, handleSize);
        
        // Bottom-right handle
        ctx.fillRect(region.x + region.width - handleSize/2, region.y + region.height - handleSize/2, handleSize, handleSize);
        
        // Middle-right handle (horizontal resize)
        ctx.fillRect(region.x + region.width - handleSize/2, region.y + region.height/2 - handleSize/2, handleSize, handleSize);
        
        // Middle-bottom handle (vertical resize)
        ctx.fillRect(region.x + region.width/2 - handleSize/2, region.y + region.height - handleSize/2, handleSize, handleSize);
      }
    });
    
  }, [regions, activeRegion, isLoading, templateImage]);

  // Define resize handles
  const getResizeHandle = (region: Region, x: number, y: number): string | null => {
    const handleSize = 10;
    
    // Top-left handle
    if (
      x >= region.x - handleSize/2 && 
      x <= region.x + handleSize/2 && 
      y >= region.y - handleSize/2 && 
      y <= region.y + handleSize/2
    ) {
      return 'top-left';
    }
    
    // Top-right handle
    if (
      x >= region.x + region.width - handleSize/2 && 
      x <= region.x + region.width + handleSize/2 && 
      y >= region.y - handleSize/2 && 
      y <= region.y + handleSize/2
    ) {
      return 'top-right';
    }
    
    // Bottom-left handle
    if (
      x >= region.x - handleSize/2 && 
      x <= region.x + handleSize/2 && 
      y >= region.y + region.height - handleSize/2 && 
      y <= region.y + region.height + handleSize/2
    ) {
      return 'bottom-left';
    }
    
    // Bottom-right handle
    if (
      x >= region.x + region.width - handleSize/2 && 
      x <= region.x + region.width + handleSize/2 && 
      y >= region.y + region.height - handleSize/2 && 
      y <= region.y + region.height + handleSize/2
    ) {
      return 'bottom-right';
    }
    
    // Middle-right handle (horizontal resize)
    if (
      x >= region.x + region.width - handleSize/2 && 
      x <= region.x + region.width + handleSize/2 && 
      y >= region.y + region.height/2 - handleSize/2 && 
      y <= region.y + region.height/2 + handleSize/2
    ) {
      return 'middle-right';
    }
    
    // Middle-bottom handle (vertical resize)
    if (
      x >= region.x + region.width/2 - handleSize/2 && 
      x <= region.x + region.width/2 + handleSize/2 && 
      y >= region.y + region.height - handleSize/2 && 
      y <= region.y + region.height + handleSize/2
    ) {
      return 'middle-bottom';
    }
    
    return null;
  };

  const [resizeHandle, setResizeHandle] = useState<string | null>(null);

  // Handle mouse events for region creation and manipulation
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // If in create mode, start creating a new region
    if (editorMode === 'create') {
      const newRegion: Region = {
        id: `region-${Date.now()}`,
        type: newRegionType,
        x,
        y,
        width: 0,
        height: 0
      };
      
      setRegions([...regions, newRegion]);
      setActiveRegion(newRegion.id);
      setIsDragging(true);
      setDragStart({ x, y });
      return;
    }
    
    // Check for resize handles on active region
    if (activeRegion) {
      const activeRegionObj = regions.find(r => r.id === activeRegion);
      if (activeRegionObj) {
        const handle = getResizeHandle(activeRegionObj, x, y);
        if (handle) {
          setResizeHandle(handle);
          setIsDragging(true);
          setDragStart({ x, y });
          return;
        }
      }
    }
    
    // Check if clicking on an existing region
    for (let i = regions.length - 1; i >= 0; i--) {
      const region = regions[i];
      if (
        x >= region.x && 
        x <= region.x + region.width && 
        y >= region.y && 
        y <= region.y + region.height
      ) {
        setActiveRegion(region.id);
        setIsDragging(true);
        setDragStart({ x, y });
        break;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !activeRegion) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setRegions(prevRegions => 
      prevRegions.map(region => {
        if (region.id === activeRegion) {
          if (resizeHandle) {
            // Handle resizing
            let newX = region.x;
            let newY = region.y;
            let newWidth = region.width;
            let newHeight = region.height;
            
            switch(resizeHandle) {
              case 'top-left':
                newX = x;
                newY = y;
                newWidth = region.width + (region.x - x);
                newHeight = region.height + (region.y - y);
                break;
              case 'top-right':
                newY = y;
                newWidth = x - region.x;
                newHeight = region.height + (region.y - y);
                break;
              case 'bottom-left':
                newX = x;
                newWidth = region.width + (region.x - x);
                newHeight = y - region.y;
                break;
              case 'bottom-right':
                newWidth = x - region.x;
                newHeight = y - region.y;
                break;
              case 'middle-right':
                newWidth = x - region.x;
                break;
              case 'middle-bottom':
                newHeight = y - region.y;
                break;
            }
            
            // Ensure minimum size
            if (newWidth < 10) newWidth = 10;
            if (newHeight < 10) newHeight = 10;
            
            return {
              ...region,
              x: newX,
              y: newY,
              width: newWidth,
              height: newHeight
            };
          } else if (editorMode === 'create') {
            // Resize during creation
            return {
              ...region,
              width: x - region.x,
              height: y - region.y
            };
          } else {
            // Move existing region
            const dx = x - dragStart.x;
            const dy = y - dragStart.y;
            
            return {
              ...region,
              x: region.x + dx,
              y: region.y + dy
            };
          }
        }
        return region;
      })
    );
    
    setDragStart({ x, y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setResizeHandle(null);
    if (editorMode === 'create') {
      setEditorMode('select');
    }
  };

  const handleDeleteRegion = () => {
    if (!activeRegion) return;
    
    setRegions(prevRegions => 
      prevRegions.filter(region => region.id !== activeRegion)
    );
    setActiveRegion(null);
  };

  const handleSave = () => {
    // Normalize negative widths/heights if any
    const normalizedRegions = regions.map(region => {
      let { x, y, width, height } = region;
      
      if (width < 0) {
        x += width;
        width = Math.abs(width);
      }
      
      if (height < 0) {
        y += height;
        height = Math.abs(height);
      }
      
      return { ...region, x, y, width, height };
    });
    
    onSaveRegions(normalizedRegions);
  };

  const getActiveRegion = () => {
    return regions.find(r => r.id === activeRegion);
  };

  const updateActiveRegionType = (type: 'text' | 'image' | 'date' | 'location') => {
    if (!activeRegion) return;
    
    setRegions(prevRegions => 
      prevRegions.map(region => 
        region.id === activeRegion ? { ...region, type } : region
      )
    );
  };

  return (
    <div className="flex flex-col items-center w-full">
      {isLoading ? (
        <div className="w-full flex justify-center items-center py-8">
          <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : loadError ? (
        <div className="w-full py-8 text-center">
          <p className="text-red-500">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-3 py-1 bg-gray-200 rounded text-sm"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="mb-3 flex gap-2 flex-wrap">
            <button
              onClick={() => setEditorMode('select')}
              className={`px-3 py-1 rounded-md text-sm ${editorMode === 'select' ? 'bg-gray-800 text-white' : 'bg-gray-200'}`}
            >
              Select
            </button>
            <button
              onClick={() => setEditorMode('create')}
              className={`px-3 py-1 rounded-md text-sm ${editorMode === 'create' ? 'bg-gray-800 text-white' : 'bg-gray-200'}`}
            >
              Create
            </button>
            
            {editorMode === 'create' && (
              <select
                value={newRegionType}
                onChange={(e) => setNewRegionType(e.target.value as any)}
                className="px-2 py-1 rounded text-sm border border-gray-300"
              >
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="date">Date</option>
                <option value="location">Location</option>
              </select>
            )}
            
            {activeRegion && (
              <>
                <button
                  onClick={handleDeleteRegion}
                  className="px-3 py-1 rounded-md text-sm bg-red-500 text-white"
                >
                  Delete
                </button>
                <select
                  value={getActiveRegion()?.type || 'text'}
                  onChange={(e) => updateActiveRegionType(e.target.value as any)}
                  className="px-2 py-1 rounded text-sm border border-gray-300"
                >
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                  <option value="date">Date</option>
                  <option value="location">Location</option>
                </select>
              </>
            )}
          </div>
          
          <div className="w-full max-w-4xl shadow rounded border border-gray-300">
            <canvas
              ref={canvasRef}
              className="w-full h-auto cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            ></canvas>
          </div>
          
          <div className="mt-3">
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-gray-800 text-white rounded-md text-sm"
            >
              Save
            </button>
          </div>
          
          <div className="mt-4 p-2 bg-gray-100 rounded-md w-full text-xs">
            <pre className="overflow-auto">
              {JSON.stringify(regions, null, 2)}
            </pre>
          </div>
        </>
      )}
    </div>
  );
};

export default JournalTemplateEditor; 