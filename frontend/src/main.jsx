import { h, render } from 'preact';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';

render(
  <HashRouter>
    <App />
  </HashRouter>,
  document.getElementById('app')
);
