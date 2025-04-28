import React, { useContext, useState } from 'react';
import { FaGoogle } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { signInWithGoogle } from '../../firebase';
import { AuthContext } from '../../App';
import { toast } from 'react-toastify';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [isLoading, setIsLoading] = useState(false);

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
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-[#f8f5f0] px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 sm:p-8">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1a1a1a] mb-2">Welcome to Mania</h1>
          <p className="text-sm sm:text-base text-[#666666]">Your personal journal space</p>
        </div>
        
        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="flex items-center justify-center w-full py-3 px-4 bg-white border border-[#d1cdc0] rounded-xl shadow-sm text-[#333333] hover:bg-[#f8f5f0] transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:transform active:scale-[0.98]"
          >
            {FaGoogle({ className: "text-red-500 mr-3 text-lg sm:text-xl" })}
            <span className="text-sm sm:text-base">{isLoading ? 'Signing in...' : 'Continue with Google'}</span>
          </button>
        </div>
        
        <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-[#666666]">
          <p>
            By continuing, you agree to our{' '}
            <a href="#" className="text-[#1a1a1a] hover:underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="text-[#1a1a1a] hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>
        
        <div className="mt-4 sm:mt-6 text-center">
          <button 
            onClick={() => navigate('/')} 
            className="text-xs sm:text-sm text-[#1a1a1a] hover:underline"
          >
            &larr; Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login; 