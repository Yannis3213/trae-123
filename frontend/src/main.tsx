import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { getUserInfo, setUserInfo, DEFAULT_USER } from './constants';

const stored = localStorage.getItem('userInfo');
if (!stored) {
  setUserInfo(DEFAULT_USER);
} else {
  try {
    JSON.parse(stored);
  } catch {
    setUserInfo(DEFAULT_USER);
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
