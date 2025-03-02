import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

function Register() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:5000/auth/register', {
        username,
        email,
        password,
        role: 'doctor', // Default role, adjust as needed
      }, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('Registration response:', response.data);
      localStorage.setItem('token', response.data.token);
      navigate('/dashboard');
    } catch (error) {
      console.error('Registration error:', error);
      let errorMessage = 'Network Error. Ensure the backend is running at http://localhost:5000.';
      if (error.response) {
        errorMessage = `Server Error: ${error.response.data.message || error.response.statusText}`;
      } else if (error.request) {
        errorMessage = 'Network Error: No response from server. Check if http://localhost:5000 is accessible.';
      } else {
        errorMessage = `Error: ${error.message}`;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="card bg-gray-800 p-6 rounded-lg shadow-2xl w-full max-w-md border border-gray-700">
        <h2 className="text-2xl font-bold mb-4 text-white text-center font-inter">{t('register')}</h2>
        {error && <div className="alert alert-error mb-4 p-3 rounded-lg text-red-400 bg-red-900">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('username')}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('username')}
              className="input input-bordered w-full bg-gray-700 text-white border-gray-600 rounded"
              required
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('email')}
              className="input input-bordered w-full bg-gray-700 text-white border-gray-600 rounded"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('password')}
              className="input input-bordered w-full bg-gray-700 text-white border-gray-600 rounded"
              required
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            className={`btn btn-primary w-full ${isLoading ? 'loading' : ''} text-white`}
            disabled={isLoading}
          >
            {t('register')}
          </button>
        </form>
        <p className="mt-4 text-center text-gray-400">
          {t('alreadyHaveAccount')}
          <button
            onClick={() => navigate('/login')}
            className="ml-1 text-blue-400 hover:text-blue-300"
          >
            {t('login')}
          </button>
        </p>
      </div>
    </div>
  );
}

export default Register;