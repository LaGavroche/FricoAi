import * as tf from '@tensorflow/tfjs';
import { ImageProcessor } from './ImageProcessor.js';
import { SUPPORTED_VEGETABLES, DISPLAY_NAMES } from '../config/vegetables.js';

export class VegetableClassifier {
  constructor() {
    this.model = null;
    this.isLoaded = false;
    this.imageProcessor = new ImageProcessor();
  }

  async loadModel(modelUrl = null) {
    try {
      console.log('🤖 Chargement du modèle custom Teachable Machine (3 classes)...');
      
      // Utilise l'URL de ton modèle par défaut ou celle fournie
      const url = modelUrl || 'https://teachablemachine.withgoogle.com/models/blBPccFh1/model.json?t=' + Date.now();
      this.model = await tf.loadLayersModel(url);
      
      this.isLoaded = true;
      console.log('✅ Modèle 3 classes chargé avec succès !');
      console.log(`🥕 ${SUPPORTED_VEGETABLES.length} légumes supportés: ${SUPPORTED_VEGETABLES.join(', ')}`);
      
    } catch (error) {
      console.error('❌ Erreur lors du chargement du modèle:', error);
      throw error;
    }
  }

  // 🔍 FONCTION DEBUG ADAPTÉE AUX 3 CLASSES
  async debugFullClassification(imagePath, realVegetableName = 'unknown') {
    console.log('🔍 === DEBUG COMPLET (3 CLASSES) ===');
    console.log(`🥕 Légume réel attendu: ${realVegetableName}`);
    console.log(`📁 Image: ${imagePath}`);
    
    try {
      const tensor = await this.imageProcessor.preprocessImage(imagePath);
      const predictions = await this.model.predict(tensor).data();
      
      console.log('📊 PRÉDICTIONS BRUTES (3 classes):');
      console.log(predictions);
      
      console.log('\n📋 MAPPAGE ACTUEL:');
      SUPPORTED_VEGETABLES.forEach((veg, index) => {
        const confidence = (predictions[index] * 100).toFixed(1);
        const isTop = predictions[index] === Math.max(...predictions);
        const marker = isTop ? '🏆' : '  ';
        console.log(`${marker} Index ${index}: ${veg} = ${confidence}%`);
      });
      
      // Trouver la classe avec la plus haute confiance
      const maxIndex = predictions.indexOf(Math.max(...predictions));
      const predictedVeg = SUPPORTED_VEGETABLES[maxIndex];
      const maxConfidence = (predictions[maxIndex] * 100).toFixed(1);
      
      console.log(`\n🎯 PRÉDICTION: ${predictedVeg} (${maxConfidence}%)`);
      console.log(`✅ RÉALITÉ: ${realVegetableName}`);
      console.log(`❌ ERREUR: ${predictedVeg !== realVegetableName ? 'OUI' : 'NON'}`);
      
      // Vérifier où se trouve le vrai légume
      const realIndex = SUPPORTED_VEGETABLES.indexOf(realVegetableName);
      if (realIndex !== -1) {
        const realConfidence = (predictions[realIndex] * 100).toFixed(1);
        console.log(`🔍 Le vrai légume (${realVegetableName}) a une confiance de: ${realConfidence}%`);
        console.log(`📍 Position du vrai légume: Index ${realIndex}`);
      }
      
      // Toutes les prédictions (seulement 3 maintenant)
      console.log('\n🏅 TOUTES LES PRÉDICTIONS:');
      const sortedPredictions = predictions.map((pred, index) => ({
        index,
        value: pred,
        name: SUPPORTED_VEGETABLES[index]
      })).sort((a, b) => b.value - a.value);
      
      sortedPredictions.forEach((pred, rank) => {
        const marker = pred.name === realVegetableName ? '✅' : '❌';
        console.log(`${rank + 1}. ${marker} ${pred.name}: ${(pred.value * 100).toFixed(1)}% (index ${pred.index})`);
      });
      
      tensor.dispose();
      console.log('\n🔍 === FIN DEBUG ===\n');
      
      return {
        predictions: predictions,
        predictedVeg: predictedVeg,
        maxConfidence: maxConfidence,
        isCorrect: predictedVeg === realVegetableName
      };
      
    } catch (error) {
      console.error('❌ Erreur debug:', error);
      throw error;
    }
  }

  async classify(imagePath, userId = 'anonymous') {
    const startTime = Date.now();
    
    try {
      if (!this.isLoaded) {
        throw new Error('Modèle non chargé');
      }

      console.log(`🔍 Classification pour utilisateur: ${userId}`);
      console.log(`📁 Chemin image: ${imagePath}`);
      
      const aiStartTime = Date.now();
      
      // 🔧 DEBUG MODE - Active automatiquement en développement
      if (process.env.NODE_ENV === 'development' || true) {
        console.log('\n🔧 === MODE DEBUG ACTIVÉ (3 CLASSES) ===');
        await this.debugFullClassification(imagePath, 'carotte'); // Change selon ton test !
        console.log('🔧 === FIN MODE DEBUG ===\n');
      }
      
      // Preprocessing de l'image
      const tensor = await this.imageProcessor.preprocessImage(imagePath);
      
      // Prédiction avec ton modèle custom
      const predictions = await this.model.predict(tensor).data();
      
      // Nettoyage mémoire
      tensor.dispose();
      
      const aiProcessingTime = Date.now() - aiStartTime;
      
      // Log des prédictions brutes
      console.log('📊 Résumé prédictions (3 classes):');
      const sortedPredictions = predictions.map((pred, index) => ({
        index,
        value: pred,
        name: SUPPORTED_VEGETABLES[index]
      })).sort((a, b) => b.value - a.value);
      
      sortedPredictions.forEach((pred, rank) => {
        console.log(`${rank + 1}. ${pred.name}: ${(pred.value * 100).toFixed(1)}% (index ${pred.index})`);
      });
      
      // Création des résultats avec tes 3 légumes
      const results = SUPPORTED_VEGETABLES.map((vegetable, index) => ({
        name: vegetable,
        displayName: DISPLAY_NAMES[vegetable],
        confidence: Math.round(predictions[index] * 100),
        isReliable: predictions[index] > 0.6 // 60% de confiance minimum pour 3 classes
      }));

      // Tri par confiance
      results.sort((a, b) => b.confidence - a.confidence);
      
      const totalTime = Date.now() - startTime;
      
      console.log(`✅ Classification terminée: ${results[0].displayName} (${results[0].confidence}%)`);
      
      return {
        vegetable: results[0],
        alternatives: results.slice(1), // Les 2 autres légumes
        image: {
          path: imagePath,
          processed: true
        },
        performance: {
          aiProcessing: `${aiProcessingTime}ms`,
          totalTime: `${totalTime}ms`
        },
        modelInfo: {
          type: 'custom_teachable_machine_3_classes',
          vegetables: SUPPORTED_VEGETABLES.length,
          version: '3.0.0',
          debugMode: true,
          supportedVegetables: SUPPORTED_VEGETABLES
        }
      };
      
    } catch (error) {
      console.error('❌ Erreur classification:', error);
      throw error;
    }
  }

  getStatus() {
    return {
      status: this.isLoaded ? 'ready' : 'loading',
      loaded: this.isLoaded,
      supportedVegetables: SUPPORTED_VEGETABLES.length,
      vegetables: SUPPORTED_VEGETABLES.map(v => DISPLAY_NAMES[v]),
      version: '3.0.0',
      modelType: 'custom_teachable_machine_3_classes'
    };
  }

  // 🧪 FONCTION TEST SPÉCIALE 3 CLASSES
  async test3ClassesModel() {
    console.log('🧪 === TEST MODÈLE 3 CLASSES ===');
    
    const testImages = {
      'tomate': 'uploads/test_tomate.jpg',
      'carotte': 'uploads/test_carotte.jpg', 
      'pomme_de_terre': 'uploads/test_pomme_de_terre.jpg'
    };
    
    const results = {};
    let successes = 0;
    
    for (const [vegetableName, imagePath] of Object.entries(testImages)) {
      console.log(`\n🧪 === TEST ${vegetableName.toUpperCase()} ===`);
      
      try {
        const fs = await import('fs');
        if (!fs.existsSync(imagePath)) {
          console.log(`⚠️ Fichier non trouvé: ${imagePath}`);
          console.log(`💡 Mets une image de ${vegetableName} dans ce chemin pour tester`);
          continue;
        }
        
        const result = await this.debugFullClassification(imagePath, vegetableName);
        results[vegetableName] = result;
        
        if (result.isCorrect) {
          successes++;
          console.log(`🎉 SUCCÈS ! ${vegetableName} détecté correctement`);
        } else {
          console.log(`❌ ÉCHEC ! Détecté comme ${result.predictedVeg}`);
        }
        
      } catch (error) {
        console.error(`❌ Erreur test ${vegetableName}:`, error.message);
      }
    }
    
    const accuracy = Object.keys(results).length > 0 ? 
      (successes / Object.keys(results).length * 100).toFixed(1) : 'N/A';
    
    console.log(`\n📊 RÉSULTAT FINAL: ${successes}/${Object.keys(results).length} (${accuracy}%)`);
    
    if (accuracy > 80) {
      console.log('🎉 EXCELLENT ! Le modèle 3 classes fonctionne bien !');
    } else if (accuracy > 60) {
      console.log('⚠️ CORRECT mais peut être amélioré');
    } else {
      console.log('🚨 PROBLÈME - Le modèle a besoin d\'être réentraîné');
    }
    
    console.log('\n🧪 === FIN TEST 3 CLASSES ===\n');
    
    return results;
  }

  dispose() {
    if (this.model) {
      this.model.dispose();
    }
  }
}