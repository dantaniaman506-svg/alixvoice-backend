require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: ['https://alixvoice-ai.vercel.app', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Routes
app.use('/webhook', require('./routes/webhook'));
app.use('/telnyx', require('./routes/telnyx'));
app.use('/elevenlabs', require('./routes/elevenlabs'));
app.use('/appointments', require('./routes/appointments'));
app.use('/payments', require('./routes/payments'));

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'AlixVoice AI Backend Running!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});