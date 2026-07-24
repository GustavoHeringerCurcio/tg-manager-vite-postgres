import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/layout/AppShell";
import LoginPage from "@/pages/LoginPage";
import NotFoundPage from "@/pages/NotFoundPage";

const ManagerPage = lazy(() => import("@/pages/ManagerPage"));
const CreateBotPage = lazy(() => import("@/pages/CreateBotPage"));
const BotDashboardPage = lazy(() => import("@/pages/BotDashboardPage"));
const BotMessagesPage = lazy(() => import("@/pages/BotMessagesPage"));
const BotRemarketingPage = lazy(() => import("@/pages/BotRemarketingPage"));
const BotRemarketingStatusPage = lazy(() => import("@/pages/BotRemarketingStatusPage"));
const BotTransactionsPage = lazy(() => import("@/pages/BotTransactionsPage"));
const BotInteractionsPage = lazy(() => import("@/pages/BotInteractionsPage"));
const BotChatPreviewPage = lazy(() => import("@/pages/BotChatPreviewPage"));
const BotGatewayPage = lazy(() => import("@/pages/BotGatewayPage"));
const BotLivepixPage = lazy(() => import("@/pages/BotLivepixPage"));
const BotPaymentButtonsPage = lazy(() => import("@/pages/BotPaymentButtonsPage"));
const BotDeliverablesPage = lazy(() => import("@/pages/BotDeliverablesPage"));
const BotSettingsPage = lazy(() => import("@/pages/BotSettingsPage"));
const UtilsPage = lazy(() => import("@/pages/UtilsPage"));

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
              <Route path="/manager/:botId/payment-settings/gateways" element={<BotGatewayPage />} />
              <Route path="/manager/:botId/payment-settings/gateways/livepix" element={<BotLivepixPage />} />
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
