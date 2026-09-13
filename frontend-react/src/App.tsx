import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./utils/contexts/auth.context";
import { LocaleContext, useLocaleState } from "./utils/contexts/locale.context";
import { Layout } from "./components/layout";
import HomePage from "./pages/home.page";
import LoginPage from "./pages/auth/login.page";
import SignupPage from "./pages/auth/signup.page";
import RankingPage from "./pages/ranking/ranking.page";
import PlayPage from "./pages/play/play.page";
import SettingsPage from "./pages/settings/settings.page";
import NotificationPreferencesPage from "./pages/settings/notification-preferences.page";
import Providers from "./utils/contexts/providers";
import { SoundProvider } from "./utils/contexts/sound.context";
import { BootScreen } from "./components/boot-screen";

export default function App() {
  // Held above the router on purpose: Paraglide keeps the locale outside React, so
  // this state re-creating every element below it is what lets components call `m.*()`
  // directly instead of subscribing to the locale.
  const locale = useLocaleState();

  return (
    <LocaleContext.Provider value={ locale }>
      <AuthProvider>
        <SoundProvider>
          <Providers>
            <BootScreen>
              <BrowserRouter>
                <Layout>
                  <Routes>
                    <Route path="/" element={ <HomePage /> } />
                    <Route path="/auth/login" element={ <LoginPage /> } />
                    <Route path="/auth/signup" element={ <SignupPage /> } />
                    <Route path="/ranking" element={ <RankingPage /> } />
                    <Route path="/play" element={ <PlayPage /> } />
                    <Route path="/settings" element={ <SettingsPage /> } />
                    <Route
                      path="/settings/notifications"
                      element={ <NotificationPreferencesPage /> }
                    />
                    <Route path="*" element={ <Navigate to="/" replace /> } />
                  </Routes>
                </Layout>
              </BrowserRouter>
            </BootScreen>
          </Providers>
        </SoundProvider>
      </AuthProvider>
    </LocaleContext.Provider>
  );
}
