import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import Login from "./pages/Login";
import OrdersList from "./pages/OrdersList";
import OrderDetail from "./pages/OrderDetail";
import NewOrder from "./pages/NewOrder";

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/orders" element={<OrdersList />} />
          <Route path="/orders/new" element={<NewOrder />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/" element={<Navigate to="/orders" replace />} />
          <Route path="*" element={<Navigate to="/orders" replace />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;
