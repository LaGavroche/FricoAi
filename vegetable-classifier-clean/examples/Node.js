import { VegetableClassifier } from '../src/index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function example() {
  const classifier = new VegetableClassifier();
  
  try {
    // Charger le modèle (utilise ton URL Teachable Machine par défaut)
    await classifier.loadModel();
    
    console.log('✅ Modèle chargé !');
    
    // Afficher le statut
    const status = classifier.getStatus();
    console.log('\n📋 Statut du classificateur:');
    console.log(`  - Status: ${status.status}`);
    console.log(`  - Légumes supportés: ${status.supportedVegetables}`);
    console.log(`  - Version: ${status.version}`);
    console.log(`  - Type: ${status.modelType}`);
    
    console.log('\n🥕 Légumes disponibles:');
    status.vegetables.forEach((veg, index) => {
      console.log(`  ${index + 1}. ${veg}`);
    });
    
    // Test avec une image (décommente si tu as une image)
    /*
    const imagePath = join(__dirname, '../tests/fixtures/test-images/test_tomate.jpg');
    console.log('\n🔍 Test de classification...');
    
    const result = await classifier.classify(imagePath, 'test-user');
    
    console.log('\n📊 Résultat:');
    console.log(`  🏆 Gagnant: ${result.vegetable.displayName} (${result.vegetable.confidence}%)`);
    console.log('  📈 Alternatives:');
    result.alternatives.forEach((alt, index) => {
      console.log(`    ${index + 1}. ${alt.displayName}: ${alt.confidence}%`);
    });
    
    console.log('\n⚡ Performance:');
    console.log(`  - IA: ${result.performance.aiProcessing}`);
    console.log(`  - Total: ${result.performance.totalTime}`);
    */
    
    // Test du modèle (nécessite des images dans uploads/)
    console.log('\n🧪 Pour lancer le test complet:');
    console.log('  1. Mets des images dans uploads/test_tomate.jpg, test_carotte.jpg, test_pomme_de_terre.jpg');
    console.log('  2. Décommente la ligne ci-dessous:');
    console.log('  // await classifier.test3ClassesModel();');
    
    // await classifier.test3ClassesModel();
    
    console.log('\n💡 Pour utiliser avec une vraie image, décommentez le code de test ci-dessus.');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    classifier.dispose();
    console.log('\n🧹 Ressources nettoyées');
  }
}

// Lancer l'exemple
console.log('🚀 Démarrage de l\'exemple Vegetable Classifier...\n');
example();