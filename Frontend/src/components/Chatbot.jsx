import { useState, useEffect } from 'react';
import { useTranslation } from '../../node_modules/react-i18next';
import axios from 'axios';
import Modal from 'react-modal';
import Plotly from 'plotly.js-dist';
import { jsPDF } from 'jspdf';

Modal.setAppElement('#root');

function Chatbot({ isOpen, onClose, token }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) setMessages([]);
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    const userMessage = { text: input, sender: 'user', timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      const response = await axios.post('http://localhost:5000/', { message: input }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const botResponse = { text: response.data, sender: 'bot', timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, botResponse]);

      if (input.toLowerCase().includes('plot')) {
        const trace1 = {
          x: [1, 2, 3, 4],
          y: [10, 15, 13, 17],
          type: 'scatter',
          mode: 'lines',
          name: t('heartRate'),
        };
        const layout = { title: t('chatbotPlot'), plot_bgcolor: '#1f2937', paper_bgcolor: '#1f2937', font: { color: '#D1D5DB' } };
        Plotly.newPlot('chatbotPlot', [trace1], layout, { displayModeBar: false });
      } else if (input.toLowerCase().includes('pdf')) {
        const doc = new jsPDF();
        doc.text(messages.map(m => `${m.sender}: ${m.text}`).join('\n'), 10, 10);
        doc.save('chat_history.pdf');
      }
    } catch (error) {
      console.error('Chatbot error:', error);
      setMessages(prev => [...prev, { text: `${t('errorChatbot')}: ${error.message}`, sender: 'bot', timestamp: new Date().toISOString() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="modal-box bg-gray-800 p-6 rounded-lg shadow-2xl max-w-2xl mx-auto mt-20 max-h-[80vh] border border-gray-700 animate__animated animate__fadeIn"
      overlayClassName="modal-overlay bg-black bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center"
    >
      <h3 className="font-bold text-2xl mb-4 text-white font-inter">{t('chatbot')}</h3>
      <div className="h-64 overflow-y-auto mb-4 p-2 bg-gray-700 rounded-lg">
        {messages.map((message, index) => (
          <div key={index} className={`mb-2 ${message.sender === 'user' ? 'text-right' : 'text-left'}`}>
            <span className={`p-2 rounded-lg ${message.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-white'} font-roboto`}>
              {message.text}
            </span>
            <span className="text-gray-400 text-sm ml-2 font-roboto">{new Date(message.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
        {isLoading && <div className="text-gray-300 font-roboto">Loading...</div>}
      </div>
      <div className="flex space-x-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder={t('typeMessage')}
          className="input input-bordered flex-1 bg-gray-700 text-white border-gray-600"
          disabled={isLoading}
        />
        <button
          onClick={handleSendMessage}
          className={`btn btn-primary ${isLoading ? 'loading' : ''}`}
          disabled={isLoading}
        >
          {t('send')}
        </button>
      </div>
      <div id="chatbotPlot" className="mt-4 h-40 rounded-lg overflow-hidden"></div>
    </Modal>
  );
}

export default Chatbot;