import React from 'react';
import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = 'Loading...' }) => {
  return (
    <motion.div 
      className="fixed inset-0 bg-[#f5f2e9] bg-opacity-90 flex flex-col items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div 
        className="w-16 h-16 relative"
        animate={{ rotate: 360 }}
        transition={{ 
          duration: 2, 
          repeat: Infinity, 
          ease: "linear" 
        }}
      >
        <div className="absolute inset-0 rounded-full border-4 border-[#d1cdc0] border-opacity-50"></div>
        <div className="absolute inset-0 rounded-full border-t-4 border-[#1a1a1a] animate-pulse"></div>
        <motion.div 
          className="absolute top-0 left-1/2 w-3 h-3 bg-[#1a1a1a] rounded-full"
          animate={{ 
            boxShadow: ['0 0 5px 2px rgba(26, 26, 26, 0.2)', '0 0 10px 5px rgba(26, 26, 26, 0.3)', '0 0 5px 2px rgba(26, 26, 26, 0.2)'] 
          }}
          transition={{ 
            duration: 1.5, 
            repeat: Infinity, 
            repeatType: "reverse" 
          }}
        />
      </motion.div>
      <motion.p 
        className="mt-6 text-xl text-[#1a1a1a]"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        {message}
      </motion.p>
    </motion.div>
  );
};

export default LoadingSpinner; 