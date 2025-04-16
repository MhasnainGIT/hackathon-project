const express = require('express');
const app = express();
const port = 5001;
app.use(express.json());

app.post('/predict', (req, res) => {
  const { anomalyScore, heartRate, spO2 } = req.body;
  const prediction = {
    anomalyScore: anomalyScore || Math.random() * 0.5,
  };
  res.json(prediction);
});

app.listen(5001, () => console.log(`AI Mock Server running on port ${port}`));

// To run: node ai-server.js in backend/