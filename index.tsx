import React from 'react';
import ReactDOM from 'react-dom/client';
import AppContent from './App';
import { AppProvider } from './context/AppContext';

// Add global styles for animation
const style = document.createElement('style');
style.innerHTML = `
  @keyframes scan {
    0% { top: 0; opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { top: 100%; opacity: 0; }
  }
  .animate-scan {
    animation: scan 2s linear infinite;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fadeIn 0.3s ease-out forwards;
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
  .animate-scale-in {
    animation: scaleIn 0.2s ease-out forwards;
  }
`;
document.head.appendChild(style);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppProvider>
      <AppContent />
    </AppProvider>
  </React.StrictMode>
);