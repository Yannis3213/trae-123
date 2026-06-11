import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import OrderList from "@/pages/OrderList";
import OrderDetail from "@/pages/OrderDetail";
import NewOrder from "@/pages/NewOrder";
import Warnings from "@/pages/Warnings";
import AuditLog from "@/pages/AuditLog";
import Layout from "@/components/Layout";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/orders" element={<Layout><OrderList /></Layout>} />
        <Route path="/orders/new" element={<Layout><NewOrder /></Layout>} />
        <Route path="/orders/:id" element={<Layout><OrderDetail /></Layout>} />
        <Route path="/warnings" element={<Layout><Warnings /></Layout>} />
        <Route path="/audit" element={<Layout><AuditLog /></Layout>} />
      </Routes>
    </Router>
  );
}
