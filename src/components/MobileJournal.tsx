import React, { useMemo, useRef, useState, useEffect } from 'react';
import JournalCanvas, { JournalCanvasHandle } from './JournalCanvas';
import type { TextColors } from './ColorPicker';
import SimpleColorPicker from './TempColorPicker';

const DEFAULT_COLORS: TextColors = {
  locationColor: '#3498DB',
  locationShadowColor: '#1D3557',
};

const TABS = ['Write', 'Images', 'Colors', 'Export'] as const;
type TabKey = typeof TABS[number];

const MobileJournal: React.FC = () => {
  const canvasRef = useRef<JournalCanvasHandle | null>(null);

  const [date, setDate] = useState<Date>(() => new Date());
  const [location, setLocation] = useState<string>('');
  const [text, setText] = useState<string>('');
  const [images, setImages] = useState<(string | Blob)[]>([]);
  const [colors, setColors] = useState<TextColors>(DEFAULT_COLORS);
  // Force freeflow layout on mobile
  const layoutMode = 'freeflow' as const;
  const [activeTab, setActiveTab] = useState<TabKey>('Write');

  // Derived journal text sections for canvas API
  const textSections = useMemo(() => [text], [text]);

  // Utilities
  const reset = () => {
    setDate(new Date());
    setLocation('');
    setText('');
    setImages([]);
    setColors(DEFAULT_COLORS);
  };

  const exportPDF = () => {
    canvasRef.current?.exportUltraHDPDF();
  };

  const handleAddImages = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: (string | Blob)[] = [];
    for (let i = 0; i < files.length; i += 1) {
      next.push(files[i]); // File is a Blob and supported by JournalCanvas
    }
    setImages(prev => [...prev, ...next]);
  };

  const removeImageAt = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // Native share (if supported)
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My Journal', text: 'Created with mania' });
      } else {
        exportPDF();
      }
    } catch {
      // ignore
    }
  };

  // Simple segmented control for layout
  // Layout switch removed on mobile; always freeflow

  const TabBar: React.FC = () => (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-black/90 border-t border-white/10 backdrop-blur-md"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
    >
      <div className="grid grid-cols-4">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`py-3 text-center text-sm ${activeTab === tab ? 'text-white' : 'text-white/60'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
    </nav>
  );

  const PanelContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="px-4 pt-3 pb-24 space-y-4">{children}</div>
  );

  const WritePanel = (
    <PanelContainer>
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-white/70">Date</label>
          <input
            type="date"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-white"
            value={new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0]}
            onChange={(e) => setDate(new Date(e.target.value))}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-white/70">Location</label>
          <input
            type="text"
            placeholder="Where are you?"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-white"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-white/70">Write</label>
          <textarea
            placeholder="Pour your thoughts..."
            rows={8}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-white"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      </div>
    </PanelContainer>
  );

  const ImagesPanel = (
    <PanelContainer>
      <div className="flex items-center justify-between">
        <div className="text-white/80 text-sm">Add images and drag on the page</div>
        <label className="px-3 py-2 bg-white/10 rounded-lg border border-white/10 text-sm">
          + Add
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleAddImages(e.target.files)}
            className="hidden"
          />
        </label>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {images.map((img, idx) => (
            <div key={idx} className="relative">
              <div className="aspect-square overflow-hidden rounded-lg border border-white/10 bg-white/5">
                {typeof img === 'string' ? (
                  <img src={img} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <img src={URL.createObjectURL(img)} alt="preview" className="w-full h-full object-cover" />
                )}
              </div>
              <button
                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-7 h-7 text-sm"
                onClick={() => removeImageAt(idx)}
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </PanelContainer>
  );

  const ColorsPanel = (
    <PanelContainer>
      <div className="space-y-3">
        <div className="text-white/80 text-sm">Pick colors for the location text</div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-2">
          <SimpleColorPicker colors={colors} onChange={setColors} images={images} compact />
        </div>
      </div>
    </PanelContainer>
  );

  const ExportPanel = (
    <PanelContainer>
      <div className="grid grid-cols-2 gap-3">
        <button
          className="py-4 rounded-xl bg-blue-600 text-white font-semibold"
          onClick={exportPDF}
        >
          Save as PDF
        </button>
        <button
          className="py-4 rounded-xl bg-white/10 border border-white/10 text-white"
          onClick={share}
        >
          Share
        </button>
        <button
          className="col-span-2 py-4 rounded-xl bg-red-600 text-white"
          onClick={reset}
        >
          Reset
        </button>
      </div>
    </PanelContainer>
  );

  useEffect(() => {
    // iOS safe-area bottom padding for the tab bar
    document.body.style.paddingBottom = '72px';
    return () => { document.body.style.paddingBottom = ''; };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Canvas preview */}
      <div className="w-full" style={{ position: 'sticky', top: 0, zIndex: 20, paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 pt-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
            <div className="w-full" style={{ height: '60vh' }}>
              <div id="journal-container" className="w-full h-full flex items-center justify-center">
                <JournalCanvas
                  ref={canvasRef}
                  date={date}
                  location={location}
                  textSections={textSections}
                  images={images}
                  onNewEntry={reset}
                  templateUrl={'/templates/cream-black-template.jpg'}
                  textColors={colors}
                  layoutMode={layoutMode}
                  editMode
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Panels */}
      {activeTab === 'Write' && WritePanel}
      {activeTab === 'Images' && ImagesPanel}
      {activeTab === 'Colors' && ColorsPanel}
      {activeTab === 'Export' && ExportPanel}

      <TabBar />
    </div>
  );
};

export default MobileJournal;


