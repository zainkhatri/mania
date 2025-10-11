import React from 'react';
import ReactDOM from 'react-dom/client';
import './anti-shake.css'; // FIRST: prevent layout shift
import './index.css'; // This imports Tailwind CSS
import App from './App';
import reportWebVitals from './reportWebVitals';

// Import the font files directly
import './font/zain.ttf';
import './font/titles.ttf';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  // Temporarily disabled StrictMode to fix glitching issue
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
