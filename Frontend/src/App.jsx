import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Register from './components/Register';
import { useTranslation } from 'react-i18next';

function App() {
  const { i18n } = useTranslation();
  const [token, setToken] = useState(localStorage.getItem('token') || null);

  useEffect(() => {
    console.log('App mounted, token:', token);
    const storedToken = localStorage.getItem('token');
    if (storedToken && !token) {
      setToken(storedToken);
    }
  }, [token]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={token ? <Dashboard token={token} /> : <Login />} />
        <Route path="/" element={token ? <Dashboard token={token} /> : <Login />} />
      </Routes>
    </Router>
  );
}

export default App;