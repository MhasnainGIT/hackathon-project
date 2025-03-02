const axios = require('axios');
const { aiApiUrl } = require('../config');

const getAnomalyPrediction = async (vitals) => {
  try {
    const response = await axios.post(aiApiUrl, vitals);
    return response.data;
  } catch (error) {
    console.error('AI prediction error:', error.message);
    return { anomalyScore: 0, prediction: 'Normal' };
  }
};

module.exports = { getAnomalyPrediction };