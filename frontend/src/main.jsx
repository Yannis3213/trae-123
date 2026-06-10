import { Router, Route, Routes } from '@solidjs/router';
import { render } from 'solid-js/web';
import App from './App.jsx';
import Login from './pages/Login.jsx';
import Contracts from './pages/Contracts.jsx';
import ContractDetail from './pages/ContractDetail.jsx';
import BatchResult from './pages/BatchResult.jsx';
import Warnings from './pages/Warnings.jsx';
import Customers from './pages/Customers.jsx';
import Pricing from './pages/Pricing.jsx';
import { AuthProvider } from './store/auth.jsx';
import './styles.css';

function Root() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" component={Login} />
          <Route path="/" component={App}>
            <Route path="/" component={Contracts} />
            <Route path="/contracts" component={Contracts} />
            <Route path="/contracts/:id" component={ContractDetail} />
            <Route path="/batch-result" component={BatchResult} />
            <Route path="/warnings" component={Warnings} />
            <Route path="/customers" component={Customers} />
            <Route path="/pricing" component={Pricing} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

render(Root, document.getElementById('root'));
