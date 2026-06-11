import { render } from 'preact';
import { Router } from 'preact-router';
import App from './App.jsx';
import Login from './components/Login.jsx';
import QueueList from './components/QueueList.jsx';
import OrderDetail from './components/OrderDetail.jsx';
import OverdueQueue from './components/OverdueQueue.jsx';
import { getCurrentUser } from './api/client.js';
import './styles.css';

const Main = () => {
  const user = getCurrentUser();
  
  if (!user) {
    return <Login />;
  }
  
  return (
    <App>
      <Router>
        <QueueList path="/" />
        <OverdueQueue path="/overdue" />
        <OrderDetail path="/order/:id" />
      </Router>
    </App>
  );
};

render(<Main />, document.getElementById('app'));
