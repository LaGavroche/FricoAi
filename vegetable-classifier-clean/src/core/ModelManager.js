import * as tf from '@tensorflow/tfjs';

export class ModelManager {
  constructor(options = {}) {
    this.options = options;
    this.model = null;
  }

  async loadModel(modelUrl) {
    try {
      console.log(`🔄 Chargement du modèle depuis: ${modelUrl}`);
      this.model = await tf.loadLayersModel(modelUrl);
      console.log('✅ Modèle chargé avec succès par ModelManager');
      return this.model;
    } catch (error) {
      console.error('❌ Erreur lors du chargement du modèle:', error);
      throw error;
    }
  }

  getModel() {
    return this.model;
  }

  getModelInfo() {
    if (!this.model) return null;
    
    return {
      inputs: this.model.inputs.map(input => ({
        name: input.name,
        shape: input.shape
      })),
      outputs: this.model.outputs.map(output => ({
        name: output.name,
        shape: output.shape
      }))
    };
  }

  dispose() {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      console.log('🧹 Modèle disposé par ModelManager');
    }
  }
}