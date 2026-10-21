import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Chat from './pages/Chat.jsx';
import SettingsDialog from './components/SettingsDialog.jsx';
import { APP_TITLE } from './lib/config.js';

export default function App() {
  useEffect(() => {
    document.title = `${APP_TITLE} · LLM Chat`;
  }, []);

  return (
    <>
      <div className="aurora" aria-hidden="true" />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SettingsDialog />
    </>
  );
}
