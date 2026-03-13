const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'ResumeForge AI Backend' });
});

app.listen(PORT, () => {
  console.log(`ResumeForge AI backend running on port ${PORT}`);
});
