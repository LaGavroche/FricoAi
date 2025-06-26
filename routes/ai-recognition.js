import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Configuration pour ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import du nouveau package IA
import VegetableClassifier from '../vegetable-classifier-clean/src/index.js';
import MultiVegetableDetector from '../vegetable-classifier-clean/src/MultiVegetableDetector.js';

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

// Instances globales des classificateurs
let classifier = null;
let multiDetector = null;

// Initialiser les classificateurs au démarrage
async function initializeClassifiers() {
  try {
    if (!classifier) {
      console.log('🤖 Initialisation du classificateur simple...');
      classifier = new VegetableClassifier();
      await classifier.loadModel();
      console.log('✅ Classificateur simple initialisé !');
    }
    
    if (!multiDetector) {
      console.log('🔍 Initialisation du détecteur multiple...');
      multiDetector = new MultiVegetableDetector();
      await multiDetector.loadModel();
      console.log('✅ Détecteur multiple initialisé !');
    }
    
    return { classifier, multiDetector };
  } catch (error) {
    console.error('❌ Erreur initialisation:', error);
    throw error;
  }
}

// Fonction utilitaire pour nettoyer les fichiers temporaires
function cleanupTempFiles(tempFiles, delay = 5000) {
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
  }, delay);
}

// Analyse de complexité d'image
async function analyzeImageComplexity(imagePath) {
  try {
    // Analyse basique basée sur les métadonnées du fichier
    const stats = fs.statSync(imagePath);
    const fileSize = stats.size;
    
    // Complexité basée sur la taille (images plus grandes = potentiellement plus complexes)
    const sizeComplexity = Math.min(fileSize / (2 * 1024 * 1024), 1); // Normalisé sur 2MB
    
    // Estimation du nombre de régions basée sur la taille
    const estimatedRegions = Math.floor(sizeComplexity * 4) + 1; // 1-5 régions
    
    return {
      complexity: sizeComplexity,
      regions: estimatedRegions,
      fileSize: fileSize
    };
    
  } catch (error) {
    console.warn('⚠️ Erreur analyse image:', error);
    return { 
      complexity: 0.3, 
      regions: 1,
      fileSize: 0
    };
  }
}

// Simulation d'un scan rapide si la méthode n'existe pas
function simulateQuickScan(imageAnalysis, predictions) {
  // Logique de simulation basée sur l'analyse d'image et les prédictions
  let detectedCount = 1;
  let confidence = predictions[0].confidence;
  
  // Si image complexe et prédictions incertaines = potentiellement plusieurs légumes
  if (imageAnalysis.complexity > 0.5 && predictions[0].confidence < 70) {
    detectedCount = imageAnalysis.regions;
    confidence = Math.max(predictions[0].confidence - 10, 30);
  }
  
  // Si très haute complexité
  if (imageAnalysis.complexity > 0.8) {
    detectedCount = Math.max(detectedCount, 2);
  }
  
  return {
    detectedCount: Math.min(detectedCount, 5), // Max 5 légumes
    confidence: confidence,
    simulated: true
  };
}

// Calcul de diversité des prédictions
function calculatePredictionDiversity(predictions) {
  if (predictions.length < 2) return 0;
  
  // Écart entre la meilleure et la deuxième prédiction
  const topTwo = predictions.slice(0, 2);
  const confidenceDiff = topTwo[0].confidence - topTwo[1].confidence;
  
  // Plus la différence est faible, plus c'est "divers" (incertain)
  const diversity = 1 - (confidenceDiff / 100);
  
  return Math.max(0, Math.min(1, diversity));
}

// NOUVELLE FONCTION: Analyser le contexte de l'image (multi-légumes vs légume unique)
function analyzeImageContext(predictions, imageAnalysis) {
  const topPrediction = predictions[0];
  const predictionDiversity = calculatePredictionDiversity(predictions);
  
  // Signes d'une image multi-légumes vs légume inconnu
  const multiVegetableIndicators = {
    // Image suffisamment grande/complexe pour contenir plusieurs légumes
    sufficientSize: imageAnalysis.fileSize > 500 * 1024, // Plus de 500KB
    highComplexity: imageAnalysis.complexity > 0.4,
    
    // Prédictions très équilibrées (signe de mélange de légumes)
    balancedPredictions: predictionDiversity > 0.8,
    veryBalanced: predictions.length >= 3 && 
                   predictions[0].confidence < 60 && 
                   predictions[1].confidence > 25 && 
                   predictions[2].confidence > 15,
    
    // Confiance faible mais pas catastrophique
    moderateLowConfidence: topPrediction.confidence >= 25 && topPrediction.confidence < 60,
    
    // Toutes les prédictions sont des légumes connus
    allKnownVegetables: predictions.every(pred => 
      ['Tomate', 'Carotte', 'Pomme de terre'].includes(pred.class)
    )
  };
  
  // Score de probabilité d'image multi-légumes
  const multiVegetableScore = [
    multiVegetableIndicators.sufficientSize ? 2 : 0,
    multiVegetableIndicators.highComplexity ? 2 : 0,
    multiVegetableIndicators.balancedPredictions ? 3 : 0,
    multiVegetableIndicators.veryBalanced ? 3 : 0,
    multiVegetableIndicators.moderateLowConfidence ? 2 : 0,
    multiVegetableIndicators.allKnownVegetables ? 2 : 0
  ].reduce((a, b) => a + b, 0);
  
  const isLikelyMultiVegetable = multiVegetableScore >= 6; // Sur 14 points max
  
  console.log(`🧩 Analyse contexte image:`);
  console.log(`   - Taille fichier: ${Math.round(imageAnalysis.fileSize / 1024)}KB`);
  console.log(`   - Complexité: ${imageAnalysis.complexity.toFixed(2)}`);
  console.log(`   - Diversité: ${predictionDiversity.toFixed(2)}`);
  console.log(`   - Prédictions équilibrées: ${multiVegetableIndicators.veryBalanced ? 'OUI' : 'NON'}`);
  console.log(`   - Score multi-légumes: ${multiVegetableScore}/14`);
  console.log(`   - Interprétation: ${isLikelyMultiVegetable ? 'IMAGE MULTI-LÉGUMES' : 'LÉGUME UNIQUE INCONNU'}`);
  
  return {
    isLikelyMultiVegetable,
    multiVegetableScore,
    indicators: multiVegetableIndicators,
    confidence: (multiVegetableScore / 14) * 100
  };
}

// Fonction AMÉLIORÉE pour déterminer si un légume doit être classé comme "non reconnu"
function shouldClassifyAsUnknown(predictions, imageAnalysis = null) {
  const topPrediction = predictions[0];
  const secondPrediction = predictions[1] || { confidence: 0 };
  
  const predictionDiversity = calculatePredictionDiversity(predictions);
  const confidenceGap = topPrediction.confidence - secondPrediction.confidence;
  
  // Si on a l'analyse d'image, vérifier le contexte
  let contextAnalysis = null;
  if (imageAnalysis) {
    contextAnalysis = analyzeImageContext(predictions, imageAnalysis);
    
    // Si c'est probablement une image multi-légumes, NE PAS classifier comme inconnu
    if (contextAnalysis.isLikelyMultiVegetable) {
      console.log(`🧩 Image multi-légumes détectée - éviter classification "inconnu"`);
      return {
        isUnknown: false,
        uncertaintyScore: 0,
        criteria: { multiVegetableImage: true },
        confidence: topPrediction.confidence,
        diversity: predictionDiversity,
        confidenceGap,
        contextAnalysis,
        bestGuess: {
          name: topPrediction.class,
          confidence: topPrediction.confidence
        }
      };
    }
  }
  
  // Critères PLUS STRICTS pour classifier comme "non reconnu"
  const unknownCriteria = {
    // Confiance vraiment très faible
    veryLowConfidence: topPrediction.confidence < 40, // Plus strict: 40 au lieu de 60
    
    // Écart très faible entre les prédictions
    veryLowConfidenceGap: confidenceGap < 15, // Plus strict: 15 au lieu de 20
    
    // Diversité extrême
    extremeDiversity: predictionDiversity > 0.85, // Plus strict: 0.85 au lieu de 0.6
    
    // Aucune prédiction vraiment dominante
    noStrongPrediction: topPrediction.confidence < 30 // Plus strict: 30 au lieu de 50
  };
  
  // Score d'incertitude (0-4) - PLUS STRICT
  const uncertaintyScore = Object.values(unknownCriteria).filter(Boolean).length;
  
  // Il faut au moins 3 critères ET confiance < 40% pour être "non reconnu"
  const isUnknown = uncertaintyScore >= 3 && topPrediction.confidence < 40;
  
  console.log(` Analyse "légume non reconnu" (stricte):`);
  console.log(`   - Confiance max: ${topPrediction.confidence}%`);
  console.log(`   - Écart top 2: ${confidenceGap.toFixed(1)}%`);
  console.log(`   - Diversité: ${predictionDiversity.toFixed(2)}`);
  console.log(`   - Critères stricts remplis: ${uncertaintyScore}/4`);
  console.log(`   - Classification: ${isUnknown ? 'LÉGUME NON RECONNU' : topPrediction.class.toUpperCase()}`);
  
  return {
    isUnknown,
    uncertaintyScore,
    criteria: unknownCriteria,
    confidence: topPrediction.confidence,
    diversity: predictionDiversity,
    confidenceGap,
    contextAnalysis,
    bestGuess: {
      name: topPrediction.class,
      confidence: topPrediction.confidence
    }
  };
}

// Détection automatique du mode AMÉLIORÉE pour les images multi-légumes
async function determineDetectionMode(imagePath) {
  try {
    console.log('🔍 Analyse préliminaire améliorée pour déterminer le mode...');
    
    // ÉTAPE 1: Analyse rapide de l'image
    const imageAnalysis = await analyzeImageComplexity(imagePath);
    
    // ÉTAPE 2: Test rapide avec le classificateur simple
    const quickPrediction = await classifier.predict(imagePath);
    
    // ÉTAPE 2.5: Vérifier le contexte (multi-légumes vs légume inconnu)
    const unknownAnalysis = shouldClassifyAsUnknown(quickPrediction, imageAnalysis);
    
    // Si contexte multi-légumes détecté, favoriser la détection multiple
    if (unknownAnalysis.contextAnalysis?.isLikelyMultiVegetable) {
      console.log('🧩 Contexte multi-légumes détecté, FAVORISER mode MULTIPLE');
      
      return {
        mode: 'multiple',
        score: 8, // Score élevé pour forcer multiple
        maxScore: 10,
        criteria: { 
          multiVegetableContext: true,
          forcedMultiple: true
        },
        confidence: unknownAnalysis.contextAnalysis.confidence,
        analysis: imageAnalysis,
        predictions: quickPrediction.slice(0, 3),
        contextAnalysis: unknownAnalysis.contextAnalysis,
        reason: 'Image multi-légumes détectée - forcer analyse multiple'
      };
    }
    
    // Si vraiment légume inconnu unique, forcer mode simple
    if (unknownAnalysis.isUnknown) {
      console.log('🚫 Légume inconnu unique détecté, forçage mode SIMPLE');
      
      return {
        mode: 'single',
        score: 0,
        maxScore: 10,
        criteria: { 
          unknownVegetable: true,
          forcedSingle: true
        },
        confidence: 0,
        analysis: imageAnalysis,
        predictions: quickPrediction.slice(0, 3),
        unknownAnalysis: unknownAnalysis,
        reason: 'Légume inconnu unique - éviter analyse multiple complexe'
      };
    }
    
    // ÉTAPE 3: Analyse normale pour légumes reconnus
    const multiScanResult = simulateQuickScan(imageAnalysis, quickPrediction);
    
    // ÉTAPE 4: Calculer les critères de décision (favoriser multiple si image complexe)
    const criteria = {
      highComplexity: imageAnalysis.complexity > 0.5, // Moins strict: 0.5 au lieu de 0.6
      multipleRegions: imageAnalysis.regions > 2,
      moderateConfidence: quickPrediction[0].confidence >= 30 && quickPrediction[0].confidence < 70, // Nouveau critère
      highDiversity: calculatePredictionDiversity(quickPrediction) > 0.6, // Moins strict
      multipleVegetablesDetected: multiScanResult.detectedCount > 1,
      multiScanConfident: multiScanResult.confidence > 40, // Moins strict
      largeFile: imageAnalysis.fileSize > 300 * 1024 // Nouveau: fichiers volumineux
    };
    
    const weights = {
      highComplexity: 2,
      multipleRegions: 2,
      moderateConfidence: 2, // Nouveau poids
      highDiversity: 3, // Augmenté
      multipleVegetablesDetected: 3,
      multiScanConfident: 1,
      largeFile: 2 // Nouveau poids
    };
    
    const multipleScore = Object.keys(criteria).reduce((score, key) => {
      return score + (criteria[key] ? weights[key] : 0);
    }, 0);
    
    const maxScore = Object.values(weights).reduce((a, b) => a + b, 0);
    
    console.log(`📊 Analyse automatique améliorée:`);
    console.log(`   - Complexité image: ${imageAnalysis.complexity.toFixed(2)}`);
    console.log(`   - Taille fichier: ${Math.round(imageAnalysis.fileSize / 1024)}KB`);
    console.log(`   - Régions détectées: ${imageAnalysis.regions}`);
    console.log(`   - Confiance principale: ${quickPrediction[0].confidence}%`);
    console.log(`   - Diversité prédictions: ${calculatePredictionDiversity(quickPrediction).toFixed(2)}`);
    console.log(`   - Score multiple: ${multipleScore}/${maxScore}`);
    console.log(`   - Critères:`, criteria);
    
    // ÉTAPE 6: Décision finale (seuil abaissé pour favoriser multiple)
    const threshold = maxScore * 0.35; // Moins strict: 35% au lieu de 40%
    const detectedMode = multipleScore >= threshold ? 'multiple' : 'single';
    
    console.log(`🎯 Mode automatiquement détecté: ${detectedMode.toUpperCase()}`);
    console.log(`   (Seuil: ${threshold.toFixed(1)}, Score: ${multipleScore})`);
    
    return {
      mode: detectedMode,
      score: multipleScore,
      maxScore: maxScore,
      criteria: criteria,
      confidence: (multipleScore / maxScore) * 100,
      analysis: imageAnalysis,
      predictions: quickPrediction.slice(0, 3),
      unknownAnalysis: unknownAnalysis
    };
    
  } catch (error) {
    console.warn('⚠️ Erreur analyse automatique, fallback vers mode simple:', error);
    return {
      mode: 'single',
      score: 0,
      maxScore: 15, // Nouveau maxScore
      criteria: {},
      confidence: 0,
      fallback: true,
      error: error.message
    };
  }
}

// Fonction pour exécuter la détection simple avec gestion honnête des légumes non reconnus
async function performSingleDetection(imagePath, fileInfo, userId, startTime) {
  let result;
  
  if (typeof classifier.classify === 'function') {
    result = await classifier.classify(imagePath, userId);
  } else if (typeof classifier.predict === 'function') {
    const predictions = await classifier.predict(imagePath);
    
    // Analyser si le légume doit être classé comme "non reconnu"
    const imageAnalysis = await analyzeImageComplexity(imagePath);
    const unknownAnalysis = shouldClassifyAsUnknown(predictions, imageAnalysis);
    
    let vegetableName, displayName, confidence, isReliable;
    
    if (unknownAnalysis.isUnknown) {
      // Classifier comme "légume non reconnu"
      vegetableName = 'unknown_vegetable';
      displayName = 'Légume non reconnu';
      confidence = 0; // Confiance à 0 pour "non reconnu"
      isReliable = false;
      
      console.log(`🚫 Légume classifié comme NON RECONNU`);
      console.log(`   - Meilleure estimation était: ${unknownAnalysis.bestGuess.name} (${unknownAnalysis.bestGuess.confidence}%)`);
      console.log(`   - Mais critères d'incertitude trop élevés`);
      
    } else {
      // Classifier normalement
      const bestPrediction = predictions[0];
      vegetableName = bestPrediction.class.toLowerCase().replace(' ', '_');
      displayName = bestPrediction.class;
      confidence = bestPrediction.confidence;
      isReliable = confidence >= 70;
      
      console.log(`✅ Légume reconnu: ${displayName} (${confidence}%)`);
    }
    
    result = {
      vegetable: {
        name: vegetableName,
        displayName: displayName,
        confidence: confidence,
        isReliable: isReliable,
        isUnknown: unknownAnalysis.isUnknown
      },
      // Toujours inclure les alternatives pour transparence
      alternatives: unknownAnalysis.isUnknown ? 
        predictions.slice(0, 3).map(pred => ({
          name: pred.class.toLowerCase().replace(' ', '_'),
          displayName: pred.class,
          confidence: pred.confidence,
          note: "Estimation rejetée car incertaine"
        })) :
        predictions.slice(1, 4).map(pred => ({
          name: pred.class.toLowerCase().replace(' ', '_'),
          displayName: pred.class,
          confidence: pred.confidence
        })),
      unknownAnalysis: {
        isUnknown: unknownAnalysis.isUnknown,
        uncertaintyScore: unknownAnalysis.uncertaintyScore,
        criteria: unknownAnalysis.criteria,
        diversity: unknownAnalysis.diversity,
        bestGuess: unknownAnalysis.bestGuess,
        contextAnalysis: unknownAnalysis.contextAnalysis,
        explanation: unknownAnalysis.isUnknown ? 
          `Ce légume ne correspond pas suffisamment aux classes connues (${unknownAnalysis.bestGuess.name}, ${unknownAnalysis.bestGuess.confidence}% de confiance seulement)` :
          `Légume identifié avec confiance acceptable`
      },
      performance: {
        aiProcessing: `${Date.now() - startTime}ms`,
        totalTime: `${Date.now() - startTime}ms`
      },
      modelInfo: {
        type: 'tensorflow_js',
        version: '1.0.0',
        supportedVegetables: ['Tomate', 'Carotte', 'Pomme de terre'],
        unknownDetectionEnabled: true,
        unknownThreshold: 40, // Seuil plus strict
        multiVegetableContextEnabled: true
      }
    };
  } else {
    throw new Error('Aucune méthode de classification disponible');
  }
  
  // Préparer pour la base de données
  const recognitionData = {
    userId: userId,
    vegetableName: result.vegetable.name,
    confidence: result.vegetable.confidence / 100,
    imageUrl: imagePath,
    detectionType: 'single',
    isUnknown: result.vegetable.isUnknown,
    unknownAnalysis: result.unknownAnalysis,
    predictions: result.vegetable.isUnknown ? 
      // Pour légumes non reconnus, sauvegarder les estimations rejetées
      result.alternatives.map(alt => ({
        name: alt.name,
        confidence: alt.confidence / 100,
        rejected: true
      })) :
      // Pour légumes reconnus, sauvegarder normalement
      [
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
      filename: fileInfo.originalname,
      size: fileInfo.size,
      width: null,
      height: null,
      format: path.extname(fileInfo.originalname).substring(1)
    },
    processingTime: parseInt(result.performance.totalTime.replace('ms', '')),
    isReliable: result.vegetable.isReliable
  };
  
  const recognition = new VegetableRecognition(recognitionData);
  await recognition.save();
  
  return {
    success: true,
    detectionType: 'single',
    result: {
      vegetable: result.vegetable,
      alternatives: result.alternatives,
      unknownAnalysis: result.unknownAnalysis,
      image: {
        originalName: fileInfo.originalname,
        size: fileInfo.size,
        path: imagePath
      },
      performance: result.performance,
      modelInfo: result.modelInfo,
      savedToDatabase: true,
      recognitionId: recognition._id
    }
  };
}

// Fonction pour exécuter la détection multiple avec gestion améliorée des légumes non reconnus
async function performMultipleDetection(imagePath, fileInfo, userId, startTime) {
  try {
    console.log('🔍 Tentative de détection multiple améliorée...');
    const multiResult = await multiDetector.detectMultipleVegetables(imagePath);
    
    // Analyser chaque légume détecté pour voir s'il est "non reconnu"
    const enrichedVegetables = multiResult.detected.map(veg => {
      const mockPredictions = [
        { class: veg.type, confidence: veg.confidence },
        { class: 'Tomate', confidence: Math.max(0, veg.confidence - 20) },
        { class: 'Carotte', confidence: Math.max(0, veg.confidence - 30) }
      ];
      const unknownAnalysis = shouldClassifyAsUnknown(mockPredictions);
      
      return {
        name: unknownAnalysis.isUnknown ? 'unknown_vegetable' : veg.type.toLowerCase().replace(' ', '_'),
        displayName: unknownAnalysis.isUnknown ? 'Légume non reconnu' : veg.type,
        confidence: unknownAnalysis.isUnknown ? 0 : veg.confidence,
        positions: veg.positions,
        detectionMethod: veg.detectionMethod,
        isUnknown: unknownAnalysis.isUnknown,
        originalEstimate: unknownAnalysis.isUnknown ? {
          name: veg.type,
          confidence: veg.confidence,
          rejected: true,
          reason: 'Confiance insuffisante pour ce légume'
        } : null
      };
    });
    
    const recognitionData = {
      userId: userId,
      vegetableName: multiResult.global.dominantVegetable.class,
      confidence: multiResult.global.dominantVegetable.confidence / 100,
      imageUrl: imagePath,
      detectionType: 'multiple',
      detectedVegetables: enrichedVegetables.map(veg => ({
        name: veg.name,
        displayName: veg.displayName,
        confidence: veg.confidence / 100,
        positions: veg.positions,
        detectionMethod: veg.detectionMethod,
        isUnknown: veg.isUnknown
      })),
      predictions: multiResult.global.allPredictions.map(pred => ({
        name: pred.class.toLowerCase().replace(' ', '_'),
        confidence: pred.confidence / 100
      })),
      imageInfo: {
        filename: fileInfo.originalname,
        size: fileInfo.size,
        width: null,
        height: null,
        format: path.extname(fileInfo.originalname).substring(1)
      },
      processingTime: Date.now() - startTime,
      isReliable: multiResult.summary.confidence >= 70,
      multiDetectionStats: {
        totalVegetables: multiResult.summary.totalVegetables,
        uniqueTypes: multiResult.summary.uniqueTypes,
        overallConfidence: multiResult.summary.confidence,
        zonesAnalyzed: multiResult.zones.length,
        unknownCount: enrichedVegetables.filter(v => v.isUnknown).length,
        knownCount: enrichedVegetables.filter(v => !v.isUnknown).length
      }
    };
    
    const recognition = new VegetableRecognition(recognitionData);
    await recognition.save();
    
    // Analyser le légume dominant
    const dominantUnknownAnalysis = shouldClassifyAsUnknown(multiResult.global.allPredictions);
    
    console.log(`🎯 Détection multiple terminée:`);
    console.log(`   - Légumes détectés: ${enrichedVegetables.length}`);
    console.log(`   - Légumes reconnus: ${enrichedVegetables.filter(v => !v.isUnknown).length}`);
    console.log(`   - Légumes non reconnus: ${enrichedVegetables.filter(v => v.isUnknown).length}`);
    
    return {
      success: true,
      detectionType: 'multiple',
      result: {
        dominantVegetable: {
          name: dominantUnknownAnalysis.isUnknown ? 'unknown_vegetable' : multiResult.global.dominantVegetable.class.toLowerCase().replace(' ', '_'),
          displayName: dominantUnknownAnalysis.isUnknown ? 'Légume non reconnu' : multiResult.global.dominantVegetable.class,
          confidence: dominantUnknownAnalysis.isUnknown ? 0 : multiResult.global.dominantVegetable.confidence,
          isReliable: !dominantUnknownAnalysis.isUnknown && multiResult.global.dominantVegetable.confidence >= 70,
          isUnknown: dominantUnknownAnalysis.isUnknown
        },
        detectedVegetables: enrichedVegetables,
        summary: {
          totalVegetables: multiResult.summary.totalVegetables,
          uniqueTypes: multiResult.summary.uniqueTypes,
          overallConfidence: multiResult.summary.confidence,
          analysisMethod: 'grid_segmentation',
          unknownVegetablesCount: enrichedVegetables.filter(v => v.isUnknown).length,
          knownVegetablesCount: enrichedVegetables.filter(v => !v.isUnknown).length
        },
        technical: {
          zonesAnalyzed: multiResult.zones.length,
          globalPredictions: multiResult.global.allPredictions,
          zoneResults: multiResult.zones
        },
        performance: {
          totalTime: `${Date.now() - startTime}ms`,
          avgTimePerZone: `${Math.round((Date.now() - startTime) / 9)}ms`
        },
        image: {
          originalName: fileInfo.originalname,
          size: fileInfo.size,
          path: imagePath
        },
        savedToDatabase: true,
        recognitionId: recognition._id
      }
    };
    
  } catch (multipleError) {
    console.warn('⚠️ Détection multiple échouée, fallback vers détection simple:', multipleError.message);
    
    // FALLBACK GRACIEUX: Utiliser la détection simple
    console.log('🔄 Fallback gracieux vers détection simple...');
    const singleResult = await performSingleDetection(imagePath, fileInfo, userId, startTime);
    
    // Enrichir le résultat pour indiquer le fallback
    singleResult.detectionType = 'single_fallback';
    singleResult.result.fallback = {
      originalAttempt: 'multiple',
      fallbackReason: multipleError.message,
      fallbackTime: Date.now() - startTime,
      graceful: true
    };
    
    return singleResult;
  }
}

// 🚀 ROUTE PRINCIPALE: Reconnaissance automatique avec détection multi-légumes améliorée
router.post('/recognize-vegetable', upload.single('image'), async (req, res) => {
  const startTime = Date.now();
  let tempFiles = [];
  
  try {
    // Validation de base
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Aucune image fournie'
      });
    }

    const imagePath = req.file.path;
    const userId = req.body.userId || req.headers['x-user-id'] || 'anonymous';
    tempFiles.push(imagePath);
    
    console.log(`🔍 Reconnaissance automatique améliorée - User: ${userId}`);
    console.log(`📁 Image: ${req.file.originalname} (${Math.round(req.file.size / 1024)}KB)`);
    
    // Initialiser les classificateurs
    await initializeClassifiers();
    
    // 🎯 DÉTECTION AUTOMATIQUE DU MODE AMÉLIORÉE
    const detectionAnalysis = await determineDetectionMode(imagePath);
    const detectedMode = detectionAnalysis.mode;
    
    console.log(`🤖 Mode détecté automatiquement: ${detectedMode.toUpperCase()}`);
    if (detectionAnalysis.contextAnalysis) {
      console.log(`🧩 Contexte détecté: ${detectionAnalysis.contextAnalysis.isLikelyMultiVegetable ? 'Multi-légumes' : 'Légume unique'}`);
    }
    
    let result;
    
    // Exécuter la détection selon le mode détecté
    if (detectedMode === 'multiple') {
      console.log('🔍 Exécution de la détection multiple améliorée...');
      result = await performMultipleDetection(imagePath, req.file, userId, startTime);
      
      // Ajouter les informations d'auto-détection
      result.result.autoDetection = {
        detectedMode: 'multiple',
        analysis: detectionAnalysis,
        reason: detectionAnalysis.contextAnalysis?.isLikelyMultiVegetable ? 
          'Image multi-légumes détectée par analyse contextuelle' :
          'Image complexe ou indices de légumes multiples détectés'
      };
      
      // Si fallback utilisé, ajuster le message
      if (result.detectionType === 'single_fallback') {
        result.result.autoDetection.actualMode = 'single_fallback';
        result.result.autoDetection.reason = 'Détection multiple tentée mais fallback vers simple nécessaire';
      }
      
    } else {
      console.log('🎯 Exécution de la détection simple...');
      result = await performSingleDetection(imagePath, req.file, userId, startTime);
      
      // Ajouter les informations d'auto-détection
      result.result.autoDetection = {
        detectedMode: 'single',
        analysis: detectionAnalysis,
        reason: detectionAnalysis.unknownAnalysis?.isUnknown ? 
          'Légume non reconnu détecté - mode simple utilisé' :
          'Image simple ou un légume principal détecté'
      };
    }
    
    console.log(`✅ Reconnaissance automatique améliorée terminée en ${Date.now() - startTime}ms`);
    
    // Nettoyer fichiers temporaires
    cleanupTempFiles(tempFiles);
    
    // Réponse avec informations d'auto-détection
    res.json({
      ...result,
      autoDetected: true,
      honestDetection: true,
      multiVegetableContextEnabled: true,
      detectionAnalysis: {
        mode: detectionAnalysis.mode,
        confidence: detectionAnalysis.confidence,
        score: `${detectionAnalysis.score}/${detectionAnalysis.maxScore}`,
        criteria: detectionAnalysis.criteria,
        contextAnalysis: detectionAnalysis.contextAnalysis
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur reconnaissance automatique améliorée:', error);
    cleanupTempFiles(tempFiles, 0);
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Route pour forcer la détection multiple (optionnelle, pour debug)
router.post('/detect-multiple-vegetables', upload.single('image'), async (req, res) => {
  const startTime = Date.now();
  let tempFiles = [];
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Aucune image fournie'
      });
    }

    const imagePath = req.file.path;
    const userId = req.body.userId || req.headers['x-user-id'] || 'anonymous';
    tempFiles.push(imagePath);
    
    console.log(`🔍 Détection multiple forcée améliorée - User: ${userId}`);
    console.log(`📁 Image: ${req.file.originalname} (${Math.round(req.file.size / 1024)}KB)`);
    
    await initializeClassifiers();
    
    const result = await performMultipleDetection(imagePath, req.file, userId, startTime);
    
    // Ajouter info sur le forçage
    result.result.forcedMode = true;
    result.result.autoDetection = {
      detectedMode: 'multiple',
      reason: 'Mode multiple forcé par l\'utilisateur'
    };
    
    console.log(`✅ Détection multiple forcée améliorée terminée en ${Date.now() - startTime}ms`);
    
    cleanupTempFiles(tempFiles);
    
    res.json({
      ...result,
      autoDetected: false,
      forcedMode: 'multiple',
      honestDetection: true,
      multiVegetableContextEnabled: true
    });
    
  } catch (error) {
    console.error('❌ Erreur détection multiple forcée:', error);
    cleanupTempFiles(tempFiles, 0);
    
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
      await initializeClassifiers();
    }
    
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
      autoDetection: true,
      honestDetection: true,
      unknownDetectionEnabled: true,
      multiVegetableContextEnabled: true,
      features: {
        autoModeDetection: true,
        unknownVegetableDetection: true,
        multiVegetableContext: true,
        gracefulFallback: true
      },
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
    
    await initializeClassifiers();
    
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

// Route pour obtenir les statistiques améliorées
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
    
    // Statistiques sur l'auto-détection et légumes non reconnus
    const detectionStats = await VegetableRecognition.aggregate([
      {
        $group: {
          _id: '$detectionType',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$confidence' }
        }
      }
    ]);
    
    const unknownStats = await VegetableRecognition.aggregate([
      {
        $group: {
          _id: '$isUnknown',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Nouvelles statistiques pour multi-légumes
    const multiVegetableStats = await VegetableRecognition.aggregate([
      {
        $match: { detectionType: 'multiple' }
      },
      {
        $group: {
          _id: null,
          totalMultiDetections: { $sum: 1 },
          avgVegetablesPerImage: { $avg: '$multiDetectionStats.totalVegetables' },
          avgUnknownPerImage: { $avg: '$multiDetectionStats.unknownCount' }
        }
      }
    ]);
    
    res.json({
      success: true,
      stats: {
        totalRecognitions,
        averageProcessingTime: averageProcessingTime[0]?.avgTime || 0,
        vegetableStats: stats,
        detectionTypeStats: detectionStats,
        unknownDetectionStats: unknownStats,
        multiVegetableStats: multiVegetableStats[0] || {
          totalMultiDetections: 0,
          avgVegetablesPerImage: 0,
          avgUnknownPerImage: 0
        },
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

// Route pour tester l'auto-détection (mode debug)
router.post('/test-auto-detection', upload.single('image'), async (req, res) => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        success: false,
        error: 'Test disponible uniquement en mode développement'
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Aucune image fournie'
      });
    }
    
    await initializeClassifiers();
    
    const imagePath = req.file.path;
    
    console.log('🧪 Test de l\'auto-détection améliorée...');
    
    const detectionAnalysis = await determineDetectionMode(imagePath);
    
    // Nettoyer le fichier
    setTimeout(() => {
      try {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      } catch (error) {
        console.warn('⚠️ Impossible de supprimer le fichier de test');
      }
    }, 1000);
    
    res.json({
      success: true,
      testMode: true,
      honestDetection: true,
      multiVegetableContextEnabled: true,
      detectionAnalysis: detectionAnalysis,
      message: 'Test de l\'auto-détection améliorée terminé - voir les logs pour les détails'
    });
    
  } catch (error) {
    console.error('❌ Erreur test auto-détection:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du test de l\'auto-détection',
      details: error.message
    });
  }
});

// Route pour tester la détection de légumes non reconnus (mode debug)
router.post('/test-unknown-detection', upload.single('image'), async (req, res) => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        success: false,
        error: 'Test disponible uniquement en mode développement'
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Aucune image fournie'
      });
    }
    
    await initializeClassifiers();
    
    const imagePath = req.file.path;
    
    console.log('🧪 Test de la détection de légumes non reconnus améliorée...');
    
    // Faire une prédiction rapide et analyse d'image
    const predictions = await classifier.predict(imagePath);
    const imageAnalysis = await analyzeImageComplexity(imagePath);
    const unknownAnalysis = shouldClassifyAsUnknown(predictions, imageAnalysis);
    
    // Nettoyer le fichier
    setTimeout(() => {
      try {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      } catch (error) {
        console.warn('⚠️ Impossible de supprimer le fichier de test');
      }
    }, 1000);
    
    res.json({
      success: true,
      testMode: true,
      unknownDetectionTest: true,
      multiVegetableContextEnabled: true,
      imageAnalysis: imageAnalysis,
      predictions: predictions,
      unknownAnalysis: unknownAnalysis,
      finalClassification: unknownAnalysis.isUnknown ? 'unknown_vegetable' : predictions[0].class,
      contextInterpretation: unknownAnalysis.contextAnalysis?.isLikelyMultiVegetable ? 
        'Image multi-légumes détectée' : 'Image légume unique',
      message: 'Test de détection légume non reconnu amélioré terminé - voir les logs pour les détails'
    });
    
  } catch (error) {
    console.error('❌ Erreur test détection légume non reconnu:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du test de détection légume non reconnu',
      details: error.message
    });
  }
});

// Route pour tester le contexte multi-légumes (mode debug)
router.post('/test-multi-context', upload.single('image'), async (req, res) => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        success: false,
        error: 'Test disponible uniquement en mode développement'
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Aucune image fournie'
      });
    }
    
    await initializeClassifiers();
    
    const imagePath = req.file.path;
    
    console.log('🧪 Test du contexte multi-légumes...');
    
    // Analyser l'image et les prédictions
    const imageAnalysis = await analyzeImageComplexity(imagePath);
    const predictions = await classifier.predict(imagePath);
    const contextAnalysis = analyzeImageContext(predictions, imageAnalysis);
    
    // Nettoyer le fichier
    setTimeout(() => {
      try {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      } catch (error) {
        console.warn('⚠️ Impossible de supprimer le fichier de test');
      }
    }, 1000);
    
    res.json({
      success: true,
      testMode: true,
      multiContextTest: true,
      imageAnalysis: imageAnalysis,
      predictions: predictions,
      contextAnalysis: contextAnalysis,
      recommendation: contextAnalysis.isLikelyMultiVegetable ? 
        'Utiliser détection multiple' : 'Utiliser détection simple',
      message: 'Test du contexte multi-légumes terminé - voir les logs pour les détails'
    });
    
  } catch (error) {
    console.error('❌ Erreur test contexte multi-légumes:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du test du contexte multi-légumes',
      details: error.message
    });
  }
});

// Initialiser les classificateurs au chargement du module
initializeClassifiers().catch(console.error);

export default router;