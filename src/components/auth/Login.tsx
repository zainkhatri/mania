import React, { useContext, useState, useRef } from 'react';
import { FaGoogle } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { signInWithGoogle } from '../../firebase';
import { AuthContext } from '../../App';
import { toast } from 'react-toastify';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      const user = await signInWithGoogle();
      
      if (user) {
        // Get the Firebase ID token
        const token = await user.getIdToken();
        
        // Call the login function from AuthContext
        login(token);
        
        // Redirect to home page
        navigate('/');
        
        toast.success(`Welcome, ${user.displayName || 'User'}!`);
      } else {
        toast.error('Login failed. Please try again.');
      }
    } catch (error: any) {
      console.error('Error logging in with Google:', error);
      toast.error(`Login error: ${error?.message || error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* TV static background video */}
      <video 
        ref={videoRef}
        className="absolute w-full h-full object-cover z-0 static-bg"
        autoPlay 
        loop 
        muted
        playsInline
      >
        <source src="/background/static.webm" type="video/webm" />
        Your browser does not support the video tag.
      </video>
      
      <div className="w-full max-w-md bg-black/70 backdrop-blur-md rounded-2xl shadow-lg p-6 sm:p-8 border border-white/20 z-10">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-2 mania-title text-flicker">
            <span className="title-container">
              {['m', 'a', 'n', 'i', 'a'].map((letter, index) => (
                <span 
                  key={`letter-${index}`}
                  className={index === 0 ? "letter-highlight" : "letter-normal"}
                >
                  {letter}
                </span>
              ))}
            </span>
          </h1>
          <p className="text-sm sm:text-base text-white/80">Your personal journal space</p>
        </div>
        
        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="flex items-center justify-center w-full py-3 px-4 bg-black/60 border border-white/30 rounded-xl shadow-sm text-white hover:bg-black/80 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:transform active:scale-[0.98]"
          >
            {FaGoogle({ className: "text-red-500 mr-3 text-lg sm:text-xl" })}
            <span className="text-sm sm:text-base">{isLoading ? 'Signing in...' : 'Continue with Google'}</span>
          </button>
        </div>
        
        <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-white/60">
          <p>
            By continuing, you agree to our{' '}
            <a href="#" className="text-white/90 hover:text-white transition-colors">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="text-white/90 hover:text-white transition-colors">
              Privacy Policy
            </a>
          </p>
        </div>
        
        <div className="mt-4 sm:mt-6 text-center">
          <button 
            onClick={() => navigate('/')} 
            className="text-xs sm:text-sm text-white/80 hover:text-white transition-colors"
          >
            &larr; Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login; 