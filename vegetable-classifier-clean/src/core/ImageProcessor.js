import * as tf from '@tensorflow/tfjs';
import sharp from 'sharp';

export class ImageProcessor {
  constructor(options = {}) {
    this.targetSize = options.targetSize || [224, 224];
  }

  /**
   * Traite une image avec Sharp + TensorFlow.js
   */
  async processImage(imagePath) {
    try {
      // Utiliser Sharp pour le preprocessing (plus fiable que tf.node)
      const processedBuffer = await sharp(imagePath)
        .resize(this.targetSize[0], this.targetSize[1])
        .removeAlpha() // Supprimer le canal alpha si présent
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Créer un tensor depuis le buffer Sharp
      const tensor = tf.tensor3d(
        new Uint8Array(processedBuffer.data), 
        [this.targetSize[0], this.targetSize[1], 3],
        'int32'
      );

      // Normaliser entre 0 et 1
      const normalized = tensor.div(255.0);
      
      // Ajouter une dimension batch
      const batched = normalized.expandDims(0);
      
      // Nettoyer les tenseurs intermédiaires
      tensor.dispose();
      normalized.dispose();
      
      return batched;
    } catch (error) {
      console.error('❌ Erreur lors du traitement de l\'image:', error);
      throw error;
    }
  }

  /**
   * Version alternative avec Buffer directement
   */
  async processImageBuffer(imageBuffer) {
    try {
      const processedBuffer = await sharp(imageBuffer)
        .resize(this.targetSize[0], this.targetSize[1])
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const tensor = tf.tensor3d(
        new Uint8Array(processedBuffer.data), 
        [this.targetSize[0], this.targetSize[1], 3],
        'int32'
      );

      const normalized = tensor.div(255.0);
      const batched = normalized.expandDims(0);
      
      tensor.dispose();
      normalized.dispose();
      
      return batched;
    } catch (error) {
      console.error('❌ Erreur traitement buffer:', error);
      throw error;
    }
  }

  /**
   * Version pour navigateur (si besoin futur)
   */
  async preprocessBrowser(imageElement) {
    let tensor;
    
    if (imageElement instanceof HTMLImageElement) {
      tensor = tf.browser.fromPixels(imageElement);
    } else if (imageElement instanceof HTMLCanvasElement) {
      tensor = tf.browser.fromPixels(imageElement);
    } else if (imageElement instanceof ImageData) {
      tensor = tf.browser.fromPixels(imageElement);
    } else {
      throw new Error('Type d\'image non supporté');
    }

    // Redimensionner
    const resized = tf.image.resizeBilinear(tensor, this.targetSize);
    
    // Normaliser
    const normalized = resized.div(255.0);
    
    // Batch
    const batched = normalized.expandDims(0);
    
    // Nettoyer
    tensor.dispose();
    resized.dispose();
    normalized.dispose();
    
    return batched;
  }

  /**
   * Obtient les informations de l'image
   */
  async getImageInfo(imagePath) {
    try {
      const metadata = await sharp(imagePath).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
        channels: metadata.channels,
        format: metadata.format
      };
    } catch (error) {
      throw new Error(`Impossible de lire l'image: ${error.message}`);
    }
  }
}