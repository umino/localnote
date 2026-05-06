import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { isStorageManagerSupported, requestPersist } from './utils/storage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (location.protocol !== 'file:') {
  if (isStorageManagerSupported()) void requestPersist();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    });
  }
}
