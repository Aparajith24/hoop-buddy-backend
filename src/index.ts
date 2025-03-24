import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import workoutRoutes from './routes/workout';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middlewares
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Routes
app.use('/api', workoutRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 