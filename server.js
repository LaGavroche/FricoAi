import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Configuration pour ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use(express.static('public'));

// Connexion MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connecté'))
  .catch(err => console.error('❌ Erreur MongoDB:', err));

// Import dynamique des routes (pour compatibilité ES modules)
const aiRecognitionRoutes = await import('./routes/ai-recognition.js');
app.use('/api/ai', aiRecognitionRoutes.default);

// Route de test
app.get('/', (req, res) => {
  res.json({ 
    message: '🥕 API Frico IA - Reconnaissance de légumes',
    status: 'active',
    endpoints: [
      'POST /api/ai/recognize-vegetable',
      'GET /api/ai/status',
      'GET /api/ai/history/:userId'
    ]
  });
});

// Gestion des erreurs
app.use((error, req, res, next) => {
  console.error('❌ Erreur serveur:', error);
  res.status(500).json({ 
    success: false, 
    error: 'Erreur interne du serveur' 
  });
});

// Démarrage serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur Frico IA démarré sur le port ${PORT}`);
  console.log(`📱 Test: http://localhost:${PORT}`);
});