export const SUPPORTED_VEGETABLES = [
  'tomate',           // Index 0 dans ton modèle
  'carotte',          // Index 1 dans ton modèle  
  'pomme_de_terre'    // Index 2 dans ton modèle
];

export const DISPLAY_NAMES = {
  'tomate': 'Tomate',
  'carotte': 'Carotte', 
  'pomme_de_terre': 'Pomme de terre'
};

export const MODEL_CONFIG = {
  inputShape: [224, 224, 3],
  numClasses: 3,
  modelUrl: './models/model.json'
};