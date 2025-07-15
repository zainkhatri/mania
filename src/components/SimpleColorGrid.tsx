import React from 'react';

interface SimpleColorGridProps {
  colors: string[];
  selectedColor: string;
  onColorSelect: (color: string) => void;
}

const SimpleColorGrid: React.FC<SimpleColorGridProps> = ({ colors, selectedColor, onColorSelect }) => {
  return (
    <div style={{ width: '100%', padding: '16px' }}>
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          width: '100%'
        }}
      >
        {colors.map((color, i) => (
          <div
            key={i}
            onClick={() => onColorSelect(color)}
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: color,
              borderRadius: '8px',
              border: selectedColor === color ? '3px solid #3b82f6' : '2px solid rgba(255,255,255,0.3)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              transform: selectedColor === color ? 'scale(1.1)' : 'scale(1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {selectedColor === color && (
              <svg width="20" height="20" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SimpleColorGrid; 