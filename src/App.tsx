import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import ConsumerVerification from "./pages/ConsumerVerification.tsx";
import FarmerDashboard from "./pages/FarmerDashboard.tsx";
import AdminPanel from "./pages/AdminPanel.tsx";
import AdminLoginGate from "./components/AdminLoginGate.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/verify" element={<ConsumerVerification />} />
          <Route path="/dashboard" element={<FarmerDashboard />} />
          <Route path="/admin" element={<AdminLoginGate><AdminPanel /></AdminLoginGate>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
