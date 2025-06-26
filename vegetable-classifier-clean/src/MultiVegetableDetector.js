// vegetable-classifier-clean/src/MultiVegetableDetector.js
import sharp from 'sharp';
import VegetableClassifier from './index.js';
import fs from 'fs';
import path from 'path';

export class MultiVegetableDetector {
  constructor() {
    this.classifier = new VegetableClassifier();
    this.gridSize = 3; // Découpe en grille 3x3 = 9 zones
  }

  async loadModel() {
    await this.classifier.loadModel();
  }

  /**
   * Détecte plusieurs légumes en découpant l'image en zones
   */
  async detectMultipleVegetables(imagePath) {
    console.log('🔍 Analyse multi-légumes de l\'image...');
    
    let zones = [];
    
    try {
      // 1. Analyser l'image entière d'abord
      const globalResult = await this.classifier.predict(imagePath);
      console.log('🌍 Prédictions globales:', globalResult.map(p => `${p.class}: ${p.confidence}%`));
      
      // 2. Découper l'image en zones (avec gestion d'erreur améliorée)
      zones = await this.createImageGrid(imagePath);
      
      // 3. Analyser chaque zone avec seuils adaptatifs
      const zoneResults = [];
      for (let i = 0; i < zones.length; i++) {
        try {
          const zoneResult = await this.classifier.predict(zones[i].path);
          
          console.log(`📍 Zone ${i + 1} prédictions:`, zoneResult.map(p => `${p.class}: ${p.confidence}%`));
          
          // NOUVEAU: Seuils adaptatifs selon le légume
          const reliablePredictions = zoneResult.filter(pred => {
            // Légumes connus avec seuils différents
            const knownVegetables = {
              'Tomate': 45,        // Seuil 45% pour tomates
              'Carotte': 35,       // Seuil 35% pour carottes (plus permissif)
              'Pomme de terre': 50  // Seuil 50% pour pommes de terre
            };
            
            const threshold = knownVegetables[pred.class] || 50; // 50% par défaut
            const isAboveThreshold = pred.confidence > threshold;
            
            if (isAboveThreshold) {
              console.log(`✅ Zone ${i + 1}: ${pred.class} détecté (${pred.confidence}% > ${threshold}%)`);
            } else {
              console.log(`❌ Zone ${i + 1}: ${pred.class} rejeté (${pred.confidence}% <= ${threshold}%)`);
            }
            
            return isAboveThreshold;
          });
          
          if (reliablePredictions.length > 0) {
            zoneResults.push({
              zone: i + 1,
              position: zones[i].position,
              vegetables: reliablePredictions,
              topVegetable: reliablePredictions[0]
            });
          } else {
            console.log(`⚠️ Zone ${i + 1}: Aucun légume fiable détecté`);
            // Afficher quand même les prédictions pour debug
            zoneResult.forEach(pred => {
              console.log(`   - ${pred.class}: ${pred.confidence}%`);
            });
          }
        } catch (zoneError) {
          console.warn(`⚠️ Erreur zone ${i + 1}:`, zoneError.message);
        }
      }
      
      // NOUVEAU: Inclure les légumes manqués du global
      const enhancedZoneResults = this.includeWeakButKnownVegetables(globalResult, zoneResults);
      
      // 4. Déduplication et agrégation améliorée
      const detectedVegetables = this.aggregateResults(globalResult, enhancedZoneResults);
      
      // 5. Nettoyer les fichiers temporaires
      await this.cleanupTempFiles(zones);
      
      return {
        global: {
          dominantVegetable: globalResult[0],
          allPredictions: globalResult
        },
        detected: detectedVegetables,
        zones: enhancedZoneResults,
        summary: {
          totalVegetables: detectedVegetables.length,
          uniqueTypes: [...new Set(detectedVegetables.map(v => v.type))].length,
          confidence: this.calculateOverallConfidence(detectedVegetables)
        }
      };
      
    } catch (error) {
      console.error('❌ Erreur détection multiple:', error);
      
      // Nettoyer les fichiers temporaires même en cas d'erreur
      if (zones.length > 0) {
        await this.cleanupTempFiles(zones);
      }
      
      throw error;
    }
  }

  /**
   * NOUVELLE MÉTHODE: Inclure les légumes manqués du global
   */
  includeWeakButKnownVegetables(globalResult, zoneResults) {
    const knownVegetables = ['Tomate', 'Carotte', 'Pomme de terre'];
    const detectedTypes = new Set(zoneResults.map(zone => zone.topVegetable.class));
    
    console.log('🔍 Vérification légumes manqués...');
    console.log('Détectés par zones:', Array.from(detectedTypes));
    
    // Vérifier si des légumes connus sont dans le global mais pas dans les zones
    globalResult.forEach(prediction => {
      if (knownVegetables.includes(prediction.class) && 
          !detectedTypes.has(prediction.class) && 
          prediction.confidence > 25) { // Seuil très bas pour inclusion
        
        console.log(`🔍 Légume manqué détecté: ${prediction.class} (${prediction.confidence}% global)`);
        
        // L'ajouter comme détection "globale" avec confiance ajustée
        zoneResults.push({
          zone: 'global_recovery',
          position: { note: 'Détecté globalement mais pas par zones' },
          vegetables: [prediction],
          topVegetable: {
            ...prediction,
            confidence: Math.max(prediction.confidence, 30) // Minimum 30%
          }
        });
      }
    });
    
    return zoneResults;
  }

  /**
   * Découpe l'image en grille avec gestion d'erreur améliorée
   */
  async createImageGrid(imagePath) {
    try {
      console.log(`📸 Analyse de l'image: ${imagePath}`);
      
      // Vérifier que le fichier existe
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Fichier image introuvable: ${imagePath}`);
      }
      
      // Obtenir les métadonnées de façon sécurisée
      const metadata = await sharp(imagePath).metadata();
      
      console.log(`📐 Métadonnées: ${metadata.width}x${metadata.height}, format: ${metadata.format}, taille: ${metadata.size} bytes`);
      
      // Vérifications de sécurité strictes
      if (!metadata.width || !metadata.height) {
        throw new Error(`Métadonnées invalides: width=${metadata.width}, height=${metadata.height}`);
      }
      
      if (metadata.width < 150 || metadata.height < 150) {
        throw new Error(`Image trop petite: ${metadata.width}x${metadata.height} (minimum 150x150 pour découpe)`);
      }
      
      const { width, height } = metadata;
      
      // Calcul sécurisé des dimensions des zones
      const zoneWidth = Math.floor(width / this.gridSize);
      const zoneHeight = Math.floor(height / this.gridSize);
      
      console.log(`📏 Dimensions des zones: ${zoneWidth}x${zoneHeight}`);
      
      // Vérifier que les zones sont assez grandes
      if (zoneWidth < 50 || zoneHeight < 50) {
        throw new Error(`Zones calculées trop petites: ${zoneWidth}x${zoneHeight} (minimum 50x50)`);
      }
      
      const zones = [];
      const tempDir = 'temp_zones';
      
      // Créer le dossier temporaire
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        console.log(`📁 Dossier temporaire créé: ${tempDir}`);
      }
      
      // Créer chaque zone avec gestion d'erreur individuelle
      for (let row = 0; row < this.gridSize; row++) {
        for (let col = 0; col < this.gridSize; col++) {
          try {
            // Calcul des coordonnées avec vérifications
            const left = col * zoneWidth;
            const top = row * zoneHeight;
            
            // Ajustement pour les dernières zones (éviter de dépasser)
            let actualWidth = zoneWidth;
            let actualHeight = zoneHeight;
            
            // Pour la dernière colonne, ajuster la largeur
            if (col === this.gridSize - 1) {
              actualWidth = width - left;
            }
            
            // Pour la dernière ligne, ajuster la hauteur
            if (row === this.gridSize - 1) {
              actualHeight = height - top;
            }
            
            // Vérifications finales
            if (left >= width || top >= height) {
              console.warn(`⚠️ Zone ${row},${col} hors limites: left=${left}, top=${top}, image=${width}x${height}`);
              continue;
            }
            
            if (actualWidth <= 0 || actualHeight <= 0) {
              console.warn(`⚠️ Zone ${row},${col} dimensions invalides: ${actualWidth}x${actualHeight}`);
              continue;
            }
            
            if (actualWidth < 30 || actualHeight < 30) {
              console.warn(`⚠️ Zone ${row},${col} trop petite: ${actualWidth}x${actualHeight}, ignorée`);
              continue;
            }
            
            // Nom de fichier sécurisé
            const timestamp = Date.now();
            const random = Math.floor(Math.random() * 1000);
            const zonePath = path.join(tempDir, `zone_${row}_${col}_${timestamp}_${random}.jpg`);
            
            console.log(`📦 Extraction zone ${row},${col}: left=${left}, top=${top}, width=${actualWidth}, height=${actualHeight}`);
            
            // Extraction avec paramètres sécurisés
            await sharp(imagePath)
              .extract({ 
                left: Math.max(0, Math.floor(left)), 
                top: Math.max(0, Math.floor(top)), 
                width: Math.floor(actualWidth), 
                height: Math.floor(actualHeight) 
              })
              .jpeg({ 
                quality: 80,
                mozjpeg: false, // Désactiver mozjpeg pour plus de compatibilité
                progressive: false
              })
              .toFile(zonePath);
            
            // Vérifier que le fichier a été créé
            if (!fs.existsSync(zonePath)) {
              throw new Error(`Fichier zone non créé: ${zonePath}`);
            }
            
            const zoneStats = fs.statSync(zonePath);
            if (zoneStats.size === 0) {
              throw new Error(`Fichier zone vide: ${zonePath}`);
            }
            
            zones.push({
              path: zonePath,
              position: {
                row,
                col,
                left: Math.floor(left),
                top: Math.floor(top),
                width: Math.floor(actualWidth),
                height: Math.floor(actualHeight)
              }
            });
            
            console.log(`✅ Zone ${row},${col} créée: ${zonePath} (${Math.round(zoneStats.size / 1024)}KB)`);
            
          } catch (zoneError) {
            console.error(`❌ Erreur création zone ${row},${col}:`, zoneError.message);
            // Continuer avec les autres zones même si une échoue
          }
        }
      }
      
      if (zones.length === 0) {
        throw new Error('Aucune zone valide n\'a pu être créée');
      }
      
      console.log(`✅ ${zones.length}/${this.gridSize * this.gridSize} zones créées avec succès`);
      return zones;
      
    } catch (error) {
      console.error('❌ Erreur createImageGrid:', error);
      throw new Error(`Impossible de créer la grille d'image: ${error.message}`);
    }
  }

  /**
   * MÉTHODE AMÉLIORÉE: Agrège les résultats pour éviter les doublons et inclure les légumes manqués
   */
  aggregateResults(globalResult, zoneResults) {
    const vegetables = new Map();
    const knownVegetables = ['Tomate', 'Carotte', 'Pomme de terre'];
    
    console.log('🔄 Agrégation des résultats...');
    
    // ÉTAPE 1: Ajouter les détections par zones (priorité haute)
    zoneResults.forEach(zone => {
      const topVeg = zone.topVegetable;
      
      if (vegetables.has(topVeg.class)) {
        // Légume déjà détecté, ajouter la position
        const existing = vegetables.get(topVeg.class);
        existing.positions.push(`zone_${zone.zone}`);
        existing.confidence = Math.max(existing.confidence, topVeg.confidence);
        existing.detectionMethod = 'multi-zone';
      } else {
        // Nouveau légume détecté
        vegetables.set(topVeg.class, {
          type: topVeg.class,
          confidence: topVeg.confidence,
          positions: [`zone_${zone.zone}`],
          detectionMethod: zone.zone === 'global_recovery' ? 'global-recovery' : 'zone',
          zonePosition: zone.position
        });
      }
      
      console.log(`✅ Ajouté: ${topVeg.class} (${topVeg.confidence}%) - zone ${zone.zone}`);
    });
    
    // ÉTAPE 2: Vérifier les légumes connus manqués dans le global
    globalResult.forEach((prediction, index) => {
      if (knownVegetables.includes(prediction.class)) {
        if (!vegetables.has(prediction.class)) {
          // Légume connu mais pas détecté par zones
          if (prediction.confidence > 20) { // Seuil très bas pour inclusion
            console.log(`🔍 Légume récupéré du global: ${prediction.class} (${prediction.confidence}%)`);
            
            vegetables.set(prediction.class, {
              type: prediction.class,
              confidence: Math.max(prediction.confidence, 30), // Minimum 30%
              positions: ['global'],
              detectionMethod: 'global-weak',
              globalRank: index + 1,
              note: 'Détecté globalement avec faible confiance'
            });
          }
        } else {
          // Légume déjà détecté, mais vérifier si on peut améliorer la confiance
          const existing = vegetables.get(prediction.class);
          if (prediction.confidence > existing.confidence) {
            console.log(`📈 Confiance améliorée: ${prediction.class} ${existing.confidence}% → ${prediction.confidence}%`);
            existing.confidence = prediction.confidence;
            if (!existing.positions.includes('global')) {
              existing.positions.push('global');
            }
            existing.detectionMethod = 'enhanced';
          }
        }
      }
    });
    
    // ÉTAPE 3: Ajouter le résultat global dominant s'il a une bonne confiance
    const dominantGlobal = globalResult[0];
    if (dominantGlobal.confidence > 60 && !vegetables.has(dominantGlobal.class)) {
      console.log(`🎯 Ajout légume dominant global: ${dominantGlobal.class} (${dominantGlobal.confidence}%)`);
      
      vegetables.set(dominantGlobal.class, {
        type: dominantGlobal.class,
        confidence: dominantGlobal.confidence,
        positions: ['global-dominant'],
        detectionMethod: 'global-dominant'
      });
    }
    
    const result = Array.from(vegetables.values())
      .sort((a, b) => {
        // Prioriser les détections par zones, puis par confiance
        if (a.detectionMethod.includes('zone') && !b.detectionMethod.includes('zone')) return -1;
        if (!a.detectionMethod.includes('zone') && b.detectionMethod.includes('zone')) return 1;
        return b.confidence - a.confidence;
      });
    
    console.log(`📊 Résultat agrégation: ${result.length} légumes détectés`);
    result.forEach(veg => {
      console.log(`   - ${veg.type}: ${veg.confidence}% (${veg.detectionMethod})`);
    });
    
    return result;
  }

  /**
   * Calcule la confiance globale
   */
  calculateOverallConfidence(vegetables) {
    if (vegetables.length === 0) return 0;
    
    const avgConfidence = vegetables.reduce((sum, veg) => sum + veg.confidence, 0) / vegetables.length;
    const bonus = vegetables.length > 1 ? 5 : 0; // Bonus si plusieurs légumes
    
    return Math.min(100, Math.round(avgConfidence + bonus));
  }

  /**
   * Nettoie les fichiers temporaires avec gestion d'erreur améliorée
   */
  async cleanupTempFiles(zones) {
    console.log(`🧹 Nettoyage de ${zones.length} fichiers temporaires...`);
    
    let cleanedCount = 0;
    
    for (const zone of zones) {
      try {
        if (fs.existsSync(zone.path)) {
          fs.unlinkSync(zone.path);
          cleanedCount++;
          console.log(`🗑️ Zone supprimée: ${zone.path}`);
        }
      } catch (error) {
        console.warn(`⚠️ Impossible de supprimer: ${zone.path} - ${error.message}`);
      }
    }
    
    // Nettoyer le dossier temporaire s'il est vide
    try {
      const tempDir = 'temp_zones';
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        if (files.length === 0) {
          fs.rmdirSync(tempDir);
          console.log(`🗑️ Dossier temporaire supprimé: ${tempDir}`);
        } else {
          console.log(`📁 ${files.length} fichiers restants dans ${tempDir}`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Impossible de nettoyer le dossier temporaire:', error.message);
    }
    
    console.log(`✅ ${cleanedCount}/${zones.length} fichiers temporaires nettoyés`);
  }

  /**
   * Scan rapide pour l'auto-détection (optionnel)
   */
  async quickScan(imagePath) {
    try {
      // Version simplifiée pour l'auto-détection
      const metadata = await sharp(imagePath).metadata();
      
      // Estimation rapide basée sur la taille et la complexité
      const estimatedCount = Math.min(5, Math.floor((metadata.width * metadata.height) / (200 * 200)));
      const confidence = metadata.width > 800 && metadata.height > 600 ? 70 : 50;
      
      return {
        detectedCount: Math.max(1, estimatedCount),
        confidence: confidence,
        quickScan: true
      };
      
    } catch (error) {
      console.warn('⚠️ Quick scan échoué:', error.message);
      return {
        detectedCount: 1,
        confidence: 30,
        quickScan: true,
        error: true
      };
    }
  }
}

export default MultiVegetableDetector;