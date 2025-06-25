# Frico AI - API de Reconnaissance de Légumes

> **API intelligente de reconnaissance de légumes utilisant TensorFlow.js et Teachable Machine**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-blue.svg)](https://expressjs.com/)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-Latest-orange.svg)](https://www.tensorflow.org/js)
[![MongoDB](https://img.shields.io/badge/MongoDB-6+-green.svg)](https://www.mongodb.com/)

## Table des Matières

- [À Propos](#à-propos)
- [Fonctionnalités](#fonctionnalités)
- [Installation](#installation)
- [Configuration](#configuration)
- [Utilisation](#utilisation)
- [API Endpoints](#api-endpoints)
- [Tests](#tests)
- [Modèle IA](#modèle-ia)
- [Contribution](#contribution)

## À Propos

**Frico AI** est une API REST moderne qui permet de reconnaître automatiquement des légumes à partir d'images. Développée avec Node.js et Express, elle utilise un modèle de machine learning entraîné avec Google Teachable Machine pour identifier avec précision différents types de légumes.

### Cas d'Usage
- Applications de gestion de stock alimentaire
- Apps de nutrition et santé
- Systèmes de tri automatique
- Applications éducatives
- Solutions IoT pour l'agriculture

## Fonctionnalités

### Intelligence Artificielle
- **Reconnaissance d'images** : Identification automatique de légumes
- **3 classes supportées** : Tomate, Carotte, Pomme de terre
- **Seuil de confiance** : 70% minimum pour une prédiction fiable
- **Modèle Teachable Machine** : Entraîné avec des images réelles

### API REST
- **Upload d'images** : Support JPG, PNG, WebP (max 10MB)
- **Réponses JSON** : Format structuré avec alternatives
- **Historique utilisateur** : Sauvegarde des prédictions
- **Statistiques** : Analytics des reconnaissances
- **Monitoring** : Status et santé de l'API

### Technique
- **Express.js** : Framework web rapide et minimaliste
- **MongoDB** : Base de données NoSQL avec Mongoose
- **Sharp** : Traitement d'images haute performance
- **Multer** : Gestion des uploads de fichiers
- **TensorFlow.js** : Machine learning dans Node.js

## Installation

### Prérequis
- **Node.js** 18+ 
- **MongoDB** 6+ (local ou cloud)
- **npm** ou **yarn**

### 1. Cloner le Projet
```bash
git clone https://github.com/votre-username/frico-ai.git
cd frico-ai
```

### 2. Installer les Dépendances
```bash
# Dépendances principales
npm install

# Dépendances du package IA
cd vegetable-classifier-clean
npm install
cd ..
```

### 3. Configuration
```bash
# Copier le fichier d'environnement
cp .env.example .env

# Éditer vos variables
nano .env
```

## Configuration

### Variables d'Environnement (.env)
```env
# Serveur
PORT=3000
NODE_ENV=development

# Base de Données
MONGODB_URI=mongodb://localhost:27017/frico-ai

# IA
AI_MODEL_URL=https://teachablemachine.withgoogle.com/models/blBPccFh1/model.json
AI_CONFIDENCE_THRESHOLD=70

# Monitoring (optionnel)
LOG_LEVEL=info
UPLOAD_MAX_SIZE=10485760
```

### Structure du Projet
```
frico-ai/
├── server.js                    # Point d'entrée
├── routes/
│   └── ai-recognition.js        # Routes API
├── models/
│   └── VegetableRecognition.js  # Schéma MongoDB
├── uploads/                     # Images temporaires
└── vegetable-classifier-clean/  # Package IA
    ├── src/
    │   ├── index.js            # Classificateur principal
    │   └── core/
    │       └── ImageProcessor.js # Traitement d'images
    └── config/
        └── vegetables.js        # Configuration légumes
```

## Utilisation

### Démarrage Rapide

1. **Lancer MongoDB** (si local)
```bash
mongod
```

2. **Démarrer l'API**
```bash
npm run dev
# ou
npm start
```

3. **Tester l'API**
```bash
curl http://localhost:3000/
```

### Exemple d'Utilisation avec JavaScript

```javascript
// Reconnaissance d'un légume
const formData = new FormData();
formData.append('image', imageFile);
formData.append('userId', 'user123');

const response = await fetch('http://localhost:3000/api/ai/recognize-vegetable', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('Légume détecté:', result.result.vegetable.displayName);
console.log('Confiance:', result.result.vegetable.confidence + '%');
```

## API Endpoints

### Routes Principales

#### `GET /`
Page d'accueil avec informations de l'API

#### `GET /api/ai/status`
Statut du classificateur et du serveur

### Reconnaissance IA

#### `POST /api/ai/recognize-vegetable`
Reconnaît un légume depuis une image

**Paramètres :**
- `image` (file) : Image du légume (JPG, PNG, WebP)
- `userId` (string, optionnel) : Identifiant utilisateur

**Réponse :**
```json
{
  "success": true,
  "result": {
    "vegetable": {
      "name": "tomate",
      "displayName": "Tomate",
      "confidence": 87,
      "isReliable": true
    },
    "alternatives": [
      {
        "name": "poivron",
        "displayName": "Poivron", 
        "confidence": 8
      }
    ],
    "performance": {
      "aiProcessing": "245ms",
      "totalTime": "312ms"
    },
    "savedToDatabase": true,
    "recognitionId": "64f..."
  }
}
```

### Analytics

#### `GET /api/ai/stats`
Statistiques globales des reconnaissances

#### `GET /api/ai/history/:userId`
Historique des reconnaissances d'un utilisateur

**Paramètres de requête :**
- `limit` : Nombre de résultats (défaut: 20)
- `page` : Numéro de page (défaut: 1)

### Tests et Debug

#### `POST /api/ai/test-model`
Lance les tests du modèle (développement uniquement)

## Tests

### Tester avec Postman
1. Importer la collection Postman fournie
2. Configurer `base_url = http://localhost:3000`
3. Tester les endpoints avec des images de légumes

### Tests Unitaires
```bash
# Lancer les tests
npm test

# Tests avec couverture
npm run test:coverage
```

### Images de Test Recommandées
- **Tomate** : Photo claire, fond simple
- **Carotte** : Carotte entière, bien éclairée  
- **Pomme de terre** : Tubercule visible, bon contraste

## Modèle IA

### Caractéristiques
- **Architecture** : CNN (Convolutional Neural Network)
- **Framework** : TensorFlow.js
- **Source** : Google Teachable Machine
- **Classes** : 3 légumes (Tomate, Carotte, Pomme de terre)
- **Taille d'entrée** : 224x224 pixels
- **Format** : RGB

### Performance
- **Précision** : ~85% sur dataset de test
- **Temps de traitement** : <500ms par image
- **Seuil de confiance** : 70% minimum
- **Taille du modèle** : ~2MB

### Améliorer le Modèle
1. Collecter plus d'images d'entraînement
2. Ajouter des nouvelles classes de légumes
3. Réentraîner sur Teachable Machine
4. Mettre à jour l'URL du modèle

## Scripts Disponibles

```bash
# Développement avec rechargement automatique
npm run dev

# Production
npm start

# Tests
npm test

# Linting
npm run lint

# Construction du package IA
npm run build:ai
```

## Dépannage

### Problèmes Courants

**Erreur MongoDB Connection**
```bash
# Vérifier que MongoDB est démarré
brew services start mongodb-community
# ou
sudo systemctl start mongod
```

**Erreur de Chargement du Modèle**
- Vérifier la connexion internet
- Contrôler l'URL du modèle dans `.env`
- Vérifier les logs du serveur

**Erreur Upload Image**
- Formats supportés : JPG, PNG, WebP uniquement
- Taille maximum : 10MB
- Vérifier les permissions du dossier `uploads/`

## Contribution

### Workflow de Contribution
1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add AmazingFeature'`)
4. Push sur la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

### Standards de Code
- **ESLint** : Configuration standard
- **Prettier** : Formatage automatique
- **Commits** : Messages explicites en français
- **Tests** : Couvrir les nouvelles fonctionnalités

## Changelog

### v1.0.0 (2025-01-15)
- Version initiale
- Reconnaissance de 3 légumes
- API REST complète
- Système d'analytics
- Persistence MongoDB

## Licence

Ce projet est sous licence **MIT** - voir le fichier [LICENSE](LICENSE) pour plus de détails.

## Auteur

**Rayan Boiteau**
- GitHub: [@rayan-boiteau](https://github.com/LaGavroche
- Email: rayan.boiteau@gmail.com

## Remerciements

- **Google Teachable Machine** pour l'outil d'entraînement
- **TensorFlow.js** pour le runtime IA
- **Sharp** pour le traitement d'images
- **MongoDB** pour la persistence
- **Express.js** pour le framework web

---

<div align="center">

**[⬆ Retour en haut](#frico-ai---api-de-reconnaissance-de-légumes)**

Made with ❤️ by Rayan Boiteau

</div># FricoAi
