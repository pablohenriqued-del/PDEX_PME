import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import CRM from "@/pages/CRM";
import Customers from "@/pages/Customers";
import Products from "@/pages/Products";
import Orders from "@/pages/Orders";
import OrderDetail from "@/pages/OrderDetail";
import Invoices from "@/pages/Invoices";
import Inventory from "@/pages/Inventory";
import Goals from "@/pages/Goals";
import Whatsapp from "@/pages/Whatsapp";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
import AuditLog from "@/pages/AuditLog";
import Pitch from "@/pages/Pitch";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/crm" element={<CRM />} />
              <Route path="/whatsapp" element={<Whatsapp />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/products" element={<Products />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/audit" element={<AuditLog />} />
              <Route path="/pitch" element={<Pitch />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
