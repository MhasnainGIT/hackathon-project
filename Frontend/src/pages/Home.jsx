import { useTranslation } from 'react-i18next';

function Home() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="card bg-gray-800 w-full max-w-md shadow-2xl p-6 text-center">
        <h1 className="text-4xl font-bold mb-4 text-white">{t('welcome')} to HealthSync AI</h1>
        <p className="text-lg mb-6 text-gray-400">{t('description')}</p>
        <div className="space-y-4">
          <a href="/login" className="btn btn-primary w-full text-white">{t('login')}</a>
          <a href="/register" className="btn btn-secondary w-full text-white">{t('register')}</a>
        </div>
      </div>
    </div>
  );
}

export default Home;