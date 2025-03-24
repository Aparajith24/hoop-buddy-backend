import express from 'express';
import { generateWorkout } from '../controllers/workoutController';

const router = express.Router();

// Generate workout plan route
router.post('/generate-workout', generateWorkout);

export default router; 