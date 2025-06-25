import mongoose from 'mongoose';

// Modèle qui correspond exactement à la structure de ton code
const vegetableRecognitionSchema = new mongoose.Schema({
  // Utilisateur
  userId: {
    type: String,
    required: true
  },
  
  // Nom du légume détecté
  vegetableName: {
    type: String,
    required: true
  },
  
  // Confiance de la prédiction (en décimal 0-1)
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  
  // Chemin vers l'image
  imageUrl: {
    type: String,
    required: true
  },
  
  // Toutes les prédictions du modèle
  predictions: [{
    name: {
      type: String,
      required: true
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    }
  }],
  
  // Informations sur l'image
  imageInfo: {
    filename: String,
    size: Number,
    width: Number,
    height: Number,
    format: String
  },
  
  // Temps de traitement en millisecondes
  processingTime: {
    type: Number,
    required: true
  },
  
  // Si la prédiction est considérée comme fiable
  isReliable: {
    type: Boolean,
    required: true
  }
}, {
  timestamps: true, // Ajoute createdAt et updatedAt automatiquement
  collection: 'vegetable_recognitions'
});

// Index pour optimiser les requêtes
vegetableRecognitionSchema.index({ userId: 1, createdAt: -1 });
vegetableRecognitionSchema.index({ vegetableName: 1 });
vegetableRecognitionSchema.index({ createdAt: -1 });
vegetableRecognitionSchema.index({ isReliable: 1 });

// Méthodes statiques pour les statistiques (utilisées dans tes routes)
vegetableRecognitionSchema.statics.getStatsByUser = function(userId) {
  return this.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: '$vegetableName',
        count: { $sum: 1 },
        avgConfidence: { $avg: '$confidence' },
        lastRecognition: { $max: '$createdAt' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

vegetableRecognitionSchema.statics.getGlobalStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$vegetableName',
        count: { $sum: 1 },
        avgConfidence: { $avg: '$confidence' },
        lastRecognition: { $max: '$createdAt' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

const VegetableRecognition = mongoose.model('VegetableRecognition', vegetableRecognitionSchema);

export default VegetableRecognition;