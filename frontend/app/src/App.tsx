import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import Landing from './pages/Landingpage';
import Login from './pages/Login';
import Signup from './pages/Signup';

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={<AppShell />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  );
};

export default App;
