import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/layout/AppShell";
import LoginPage from "@/pages/LoginPage";
import ManagerPage from "@/pages/ManagerPage";
import CreateBotPage from "@/pages/CreateBotPage";
import BotDashboardPage from "@/pages/BotDashboardPage";
import BotMessagesPage from "@/pages/BotMessagesPage";
import BotRemarketingPage from "@/pages/BotRemarketingPage";
import BotRemarketingStatusPage from "@/pages/BotRemarketingStatusPage";
import BotTransactionsPage from "@/pages/BotTransactionsPage";
import BotInteractionsPage from "@/pages/BotInteractionsPage";
import BotChatPreviewPage from "@/pages/BotChatPreviewPage";
import BotPaymentPage from "@/pages/BotPaymentPage";
import BotLivepixPage from "@/pages/BotLivepixPage";
import BotPaymentButtonsPage from "@/pages/BotPaymentButtonsPage";
import BotDeliverablesPage from "@/pages/BotDeliverablesPage";
import BotSettingsPage from "@/pages/BotSettingsPage";
import NotFoundPage from "@/pages/NotFoundPage";
import UtilsPage from "@/pages/UtilsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/manager" replace />} />
            <Route path="/manager" element={<ManagerPage />} />
            <Route path="/manager/new" element={<CreateBotPage />} />
            <Route path="/manager/:botId/dashboard" element={<BotDashboardPage />} />
            <Route path="/manager/:botId/settings" element={<BotSettingsPage />} />
            <Route path="/manager/:botId/messages" element={<BotMessagesPage />} />
            <Route path="/manager/:botId/remarketing" element={<BotRemarketingPage />} />
            <Route path="/manager/:botId/remarketing-status" element={<BotRemarketingStatusPage />} />
            <Route path="/manager/:botId/transactions" element={<BotTransactionsPage />} />
            <Route path="/manager/:botId/interactions" element={<BotInteractionsPage />} />
            <Route path="/manager/:botId/chat-preview" element={<BotChatPreviewPage />} />
            <Route path="/manager/:botId/payment-settings" element={<BotPaymentPage />} />
            <Route path="/manager/:botId/payment-settings/livepix" element={<BotLivepixPage />} />
            <Route path="/manager/:botId/payment-settings/payment-buttons" element={<BotPaymentButtonsPage />} />
            <Route path="/manager/:botId/payment-settings/deliverables" element={<BotDeliverablesPage />} />
            <Route path="/utils" element={<UtilsPage />} />
            <Route path="/utils/file-id" element={<Navigate to="/utils?tool=file-id" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}
