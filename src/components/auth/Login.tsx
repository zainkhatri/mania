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
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-lg w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Mania</h1>
          <p className="text-gray-600">Your personal journal space</p>
        </div>
        
        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="flex items-center justify-center w-full py-3 px-4 bg-white border border-gray-300 rounded-md shadow-sm text-gray-700 hover:bg-gray-50 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {FaGoogle({ className: "text-red-500 mr-3", size: 20 })}
            <span>{isLoading ? 'Signing in...' : 'Continue with Google'}</span>
          </button>
        </div>
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            By continuing, you agree to our{' '}
            <a href="#" className="text-blue-600 hover:underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="text-blue-600 hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>
        
        <div className="mt-6 text-center">
          <button 
            onClick={() => navigate('/')} 
            className="text-sm text-blue-600 hover:underline"
          >
            &larr; Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login; 