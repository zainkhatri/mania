import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useContext(AuthContext);

  const handleStart = () => {
    if (isAuthenticated) {
      navigate('/journal');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] bg-[#f8f5f0]">
      <h1 className="font-serif text-7xl font-bold text-[#232323] mb-6">mania</h1>
      <p className="text-2xl text-[#333333] mb-12">Create zain's journals without the pen in your hand.</p>
      <button
        onClick={handleStart}
        className="flex items-center px-8 py-5 bg-[#181818] text-white text-2xl font-bold rounded-2xl shadow-md hover:bg-[#232323] transition-all"
      >
        <span className="mr-3">↓</span> Start Journaling
      </button>
    </div>
  );
};

export default Home; 