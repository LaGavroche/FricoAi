/**
 * Classificateur de légumes simple - Version basée sur ta v1
 */

import * as tf from '@tensorflow/tfjs';
import { ImageProcessor } from './core/ImageProcessor.js';

class VegetableClassifier {
  constructor(options = {}) {
    // 🔧 CORRIGÉ - Utilise TON URL Teachable Machine
    this.modelUrl = options.modelUrl || 'https://teachablemachine.withgoogle.com/models/blBPccFh1/model.json';
    this.model = null;
    this.isModelLoaded = false;
    this.imageProcessor = new ImageProcessor();
    
    // 🔧 CORRIGÉ - Classes selon TON modèle (3 classes)
    this.classNames = [
      'Tomate', 'Carotte', 'Pomme de terre'
    ];
  }

  /**
   * Charge le modèle
   */
  async loadModel() {
    try {
      console.log(`🔄 Chargement du modèle Teachable Machine: ${this.modelUrl}`);
      this.model = await tf.loadLayersModel(this.modelUrl);
      this.isModelLoaded = true;
      console.log('✅ Modèle Teachable Machine chargé avec succès');
      console.log(`🥕 Classes supportées: ${this.classNames.join(', ')}`);
      return this.model;
    } catch (error) {
      console.error('❌ Erreur chargement modèle:', error);
      throw error;
    }
  }

  /**
   * Fait une prédiction
   */
  async predict(imagePath) {
    if (!this.isModelLoaded) {
      throw new Error('Modèle non chargé');
    }

    try {
      console.log(`🔍 Analyse de l'image: ${imagePath}`);
      
      // Utilise ton ImageProcessor existant
      const processedImage = await this.imageProcessor.processImage(imagePath);
      
      // Prédiction
      const predictions = this.model.predict(processedImage);
      const probabilities = await predictions.data();
      
      console.log('📊 Prédictions brutes:', Array.from(probabilities));
      
      // Format des résultats
      const results = this.classNames.map((name, i) => ({
        class: name,
        probability: probabilities[i],
        confidence: Math.round(probabilities[i] * 100)
      }));

      // Tri par confiance
      results.sort((a, b) => b.probability - a.probability);

      console.log(`🎯 Top prédiction: ${results[0].class} (${results[0].confidence}%)`);

      // Nettoyage
      predictions.dispose();
      processedImage.dispose();

      return results;
    } catch (error) {
      console.error('❌ Erreur prédiction:', error);
      throw error;
    }
  }

  /**
   * Méthode classify pour compatibilité avec ta route
   */
  async classify(imagePath, userId = 'anonymous') {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Classification pour utilisateur: ${userId}`);
      
      // Utiliser la méthode predict
      const predictions = await this.predict(imagePath);
      
      const totalTime = Date.now() - startTime;
      
      // Format compatible avec ta route
      const result = {
        vegetable: {
          name: predictions[0].class.toLowerCase().replace(' ', '_'),
          displayName: predictions[0].class,
          confidence: predictions[0].confidence,
          isReliable: predictions[0].confidence >= 70 // Seuil strict à 70%
        },
        alternatives: predictions.slice(1).map(pred => ({
          name: pred.class.toLowerCase().replace(' ', '_'),
          displayName: pred.class,
          confidence: pred.confidence
        })),
        image: {
          path: imagePath,
          processed: true
        },
        performance: {
          aiProcessing: `${totalTime}ms`,
          totalTime: `${totalTime}ms`
        },
        modelInfo: {
          type: 'teachable_machine',
          version: '1.0.0',
          classes: this.classNames.length,
          supportedVegetables: this.classNames
        }
      };
      
      return result;
      
    } catch (error) {
      console.error('❌ Erreur classification:', error);
      throw error;
    }
  }

  /**
   * Obtient le statut
   */
  getStatus() {
    return {
      status: this.isModelLoaded ? 'ready' : 'loading',
      loaded: this.isModelLoaded,
      supportedVegetables: this.classNames.length,
      vegetables: this.classNames,
      version: '1.0.0',
      modelType: 'teachable_machine',
      modelUrl: this.modelUrl
    };
  }

  /**
   * Obtient les noms des classes
   */
  getClassNames() {
    return this.classNames;
  }

  /**
   * Vérifie si prêt
   */
  isReady() {
    return this.isModelLoaded;
  }

  /**
   * Vérifie si le modèle est chargé
   */
  isModelLoadedMethod() {
    return this.isModelLoaded;
  }

  /**
   * Nettoie les ressources
   */
  dispose() {
    if (this.model) {
      this.model.dispose();
    }
  }
}

export default VegetableClassifier;