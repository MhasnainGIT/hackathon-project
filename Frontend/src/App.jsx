// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Register from './components/Register';
import ErrorBoundary from './components/ErrorBoundary'; // Import ErrorBoundary

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <Router>
        <ErrorBoundary> {/* Add ErrorBoundary here */}
          <Routes>
            <Route path="/dashboard" element={<Dashboard token={localStorage.getItem('token')} />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Login />} />
          </Routes>
        </ErrorBoundary>
      </Router>
    </I18nextProvider>
  );
}

export default App;