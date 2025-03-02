import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    hmr: {
      overlay: false, // Disable the error overlay if needed
    },
  },
  resolve: {
    alias: {
      'plotly.js': 'plotly.js-dist',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          plotly: ['plotly.js-dist'],
          chartjs: ['chart.js', 'react-chartjs-2', 'chartjs-adapter-date-fns', 'date-fns', 'chartjs-plugin-zoom'], // Added chartjs-plugin-zoom
          d3: ['d3'],
          ethers: ['ethers'],
          twilio: ['twilio-video'],
          jspdf: ['jspdf'],
          i18n: ['i18next', 'react-i18next'],
          speech: ['react-speech-recognition', 'regenerator-runtime'],
          socket: ['socket.io-client'],
          simplewebauthn: ['@simplewebauthn/browser'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['regenerator-runtime', 'socket.io-client', 'date-fns', '@simplewebauthn/browser', 'chartjs-plugin-zoom'], // Added chartjs-plugin-zoom
  },
});