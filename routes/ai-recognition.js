import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Configuration pour ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import du nouveau package IA - CORRIGÉ
import VegetableClassifier from '../vegetable-classifier-clean/src/index.js';

// Import du modèle MongoDB
import VegetableRecognition from '../models/VegetableRecognition.js';

const router = express.Router();

// Configuration Multer pour upload d'images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Seules les images (JPEG, PNG, WebP) sont autorisées'));
    }
  }
});

// Instance globale du classificateur
let classifier = null;

// Initialiser le classificateur au démarrage
async function initializeClassifier() {
  try {
    if (!classifier) {
      console.log('🤖 Initialisation du classificateur...');
      classifier = new VegetableClassifier();
      await classifier.loadModel();
      console.log('✅ Classificateur initialisé avec succès !');
    }
    return classifier;
  } catch (error) {
    console.error('❌ Erreur initialisation classificateur:', error);
    throw error;
  }
}

// Route principale de reconnaissance
router.post('/recognize-vegetable', upload.single('image'), async (req, res) => {
  const startTime = Date.now();
  let tempFiles = [];
  
  try {
    // Vérifier la présence de l'image
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Aucune image fournie'
      });
    }

    const imagePath = req.file.path;
    const userId = req.body.userId || req.headers['x-user-id'] || 'anonymous';
    
    tempFiles.push(imagePath);
    
    console.log(`🔍 Nouvelle demande de reconnaissance - User: ${userId}`);
    console.log(`📁 Image: ${req.file.originalname} (${Math.round(req.file.size / 1024)}KB)`);
    
    // S'assurer que le classificateur est initialisé
    await initializeClassifier();
    
    // Classification - CORRIGÉ pour utiliser la méthode qui existe
    let result;
    
    // Vérifier si le classificateur a une méthode classify (ton ancien code)
    if (typeof classifier.classify === 'function') {
      result = await classifier.classify(imagePath, userId);
    } 
    // Sinon utiliser predict (nouveau code)
    else if (typeof classifier.predict === 'function') {
      const predictions = await classifier.predict(imagePath);
      
      // Adapter le format pour correspondre à ton ancien format
      result = {
        vegetable: {
          name: predictions[0].class.toLowerCase().replace(' ', '_'),
          displayName: predictions[0].class,
          confidence: predictions[0].confidence,
          isReliable: predictions[0].confidence >= 70
        },
        alternatives: predictions.slice(1, 4).map(pred => ({
          name: pred.class.toLowerCase().replace(' ', '_'),
          displayName: pred.class,
          confidence: pred.confidence
        })),
        performance: {
          aiProcessing: `${Date.now() - startTime}ms`,
          totalTime: `${Date.now() - startTime}ms`
        },
        modelInfo: {
          type: 'tensorflow_js',
          version: '1.0.0',
          supportedVegetables: predictions.length
        }
      };
    } else {
      throw new Error('Aucune méthode de classification disponible');
    }
    
    // Préparer les données pour MongoDB
    const recognitionData = {
      userId: userId,
      vegetableName: result.vegetable.name,
      confidence: result.vegetable.confidence / 100, // Convertir en décimal
      imageUrl: imagePath,
      predictions: [
        {
          name: result.vegetable.name,
          confidence: result.vegetable.confidence / 100
        },
        ...result.alternatives.map(alt => ({
          name: alt.name,
          confidence: alt.confidence / 100
        }))
      ],
      imageInfo: {
        filename: req.file.originalname,
        size: req.file.size,
        width: null,
        height: null,
        format: path.extname(req.file.originalname).substring(1)
      },
      processingTime: parseInt(result.performance.totalTime.replace('ms', '')),
      isReliable: result.vegetable.isReliable
    };
    
    // Sauvegarder en base de données
    const recognition = new VegetableRecognition(recognitionData);
    await recognition.save();
    
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ Reconnaissance terminée en ${totalTime}ms: ${result.vegetable.displayName} (${result.vegetable.confidence}%)`);
    
    // Nettoyer le fichier temporaire après traitement
    setTimeout(() => {
      tempFiles.forEach(file => {
        try {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
            console.log(`🗑️ Fichier temporaire supprimé: ${file}`);
          }
        } catch (cleanupError) {
          console.warn(`⚠️ Impossible de supprimer: ${file}`);
        }
      });
    }, 5000); // Attendre 5 secondes avant de supprimer
    
    // Réponse avec toutes les infos
    res.json({
      success: true,
      result: {
        vegetable: {
          name: result.vegetable.name,
          displayName: result.vegetable.displayName,
          confidence: result.vegetable.confidence,
          isReliable: result.vegetable.isReliable
        },
        alternatives: result.alternatives.map(alt => ({
          name: alt.name,
          displayName: alt.displayName,
          confidence: alt.confidence
        })),
        image: {
          originalName: req.file.originalname,
          size: req.file.size,
          path: imagePath
        },
        performance: {
          aiProcessing: result.performance.aiProcessing,
          totalTime: `${totalTime}ms`
        },
        modelInfo: result.modelInfo,
        savedToDatabase: true,
        recognitionId: recognition._id
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur reconnaissance:', error);
    
    // Nettoyer les fichiers temporaires en cas d'erreur
    tempFiles.forEach(file => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (cleanupError) {
        console.warn(`⚠️ Impossible de supprimer: ${file}`);
      }
    });
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Route pour obtenir le statut du classificateur
router.get('/status', async (req, res) => {
  try {
    if (!classifier) {
      await initializeClassifier();
    }
    
    // Vérifier quelle méthode existe
    let status;
    if (typeof classifier.getStatus === 'function') {
      status = classifier.getStatus();
    } else {
      status = {
        status: classifier.isReady ? classifier.isReady() ? 'ready' : 'loading' : 'unknown',
        loaded: classifier.isModelLoaded ? classifier.isModelLoaded() : false,
        version: '1.0.0',
        type: 'tensorflow_js'
      };
    }
    
    res.json({
      success: true,
      status: status,
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du statut',
      details: error.message
    });
  }
});

// Route pour obtenir l'historique d'un utilisateur
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, page = 1 } = req.query;
    
    const skip = (page - 1) * limit;
    
    const recognitions = await VegetableRecognition
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .select('-__v');
    
    const total = await VegetableRecognition.countDocuments({ userId });
    
    res.json({
      success: true,
      data: {
        recognitions,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur récupération historique:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de l\'historique'
    });
  }
});

// Route pour tester le modèle (mode debug)
router.post('/test-model', async (req, res) => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        success: false,
        error: 'Test disponible uniquement en mode développement'
      });
    }
    
    await initializeClassifier();
    
    console.log('🧪 Démarrage du test du modèle...');
    
    let testResults;
    if (typeof classifier.test3ClassesModel === 'function') {
      testResults = await classifier.test3ClassesModel();
    } else {
      testResults = { message: 'Méthode de test non disponible' };
    }
    
    res.json({
      success: true,
      testResults: testResults,
      message: 'Test du modèle terminé - voir les logs du serveur pour les détails'
    });
    
  } catch (error) {
    console.error('❌ Erreur test modèle:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du test du modèle',
      details: error.message
    });
  }
});

// Route pour obtenir les statistiques
router.get('/stats', async (req, res) => {
  try {
    const stats = await VegetableRecognition.aggregate([
      {
        $group: {
          _id: '$vegetableName',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$confidence' },
          lastRecognition: { $max: '$createdAt' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    const totalRecognitions = await VegetableRecognition.countDocuments();
    const averageProcessingTime = await VegetableRecognition.aggregate([
      {
        $group: {
          _id: null,
          avgTime: { $avg: '$processingTime' }
        }
      }
    ]);
    
    res.json({
      success: true,
      stats: {
        totalRecognitions,
        averageProcessingTime: averageProcessingTime[0]?.avgTime || 0,
        vegetableStats: stats,
        generatedAt: new Date()
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur récupération stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques'
    });
  }
});

// Initialiser le classificateur au chargement du module
initializeClassifier().catch(console.error);

export default router;