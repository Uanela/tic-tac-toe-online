import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./utils/contexts/auth.context";
import { Navbar } from "./components/navbar";
import HomePage from "./pages/home.page";
import LoginPage from "./pages/auth/login.page";
import SignupPage from "./pages/auth/signup.page";
import RankingPage from "./pages/ranking/ranking.page";
import PlayPage from "./pages/play/play.page";
import Providers from "./utils/contexts/providers";

export default function App() {
  return (
    <AuthProvider>
      <Providers>
        <BrowserRouter>
          <Navbar />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/signup" element={<SignupPage />} />
            <Route path="/ranking" element={<RankingPage />} />
            <Route path="/play" element={<PlayPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </Providers>
    </AuthProvider>
  );
}
