import { Injectable } from '@angular/core';

export interface TargetPokemon {
  id: number;
  pokedexId: number;
  name: string;
  displayName: string;
  types: string[];
  referenceAsset: string;
  themeColor: string;
}

export interface ClassificationResult {
  detected: boolean;
  pokemon: TargetPokemon | null;
  confidence: number;
  scores: {
    pikachu: number;
    charmander: number;
    bulbasaur: number;
    background: number;
  };
  dominantHue?: number;
  message: string;
  debugInfo?: {
    matchingPixels: number;
    totalSubjectPixels: number;
    coveragePercent: number;
  };
}

export interface ClassifierConfig {
  confidenceThreshold: number;  // Umbral mínimo de certeza: 85% (0.85)
  minSubjectPixels: number;     // Mínimo absoluto de píxeles del Pokémon en la mira (450 px)
  minCoveragePercent: number;   // Porcentaje mínimo de cobertura del cuadro (5.0%)
  colorMarginThreshold: number; // Ventaja mínima sobre la segunda clase (20%)
}

@Injectable({
  providedIn: 'root',
})
export class PokemonClassifierService {
  /**
   * =========================================================================
   * PARÁMETROS DE SENSIBILIDAD Y CONTROL DE FALSOS POSITIVOS
   * (Modificar aquí para afinar si el ambiente es muy oscuro o brillante)
   * =========================================================================
   */
  config: ClassifierConfig = {
    // 1. Umbral de certeza mínima para confirmar detección (>= 80% estricto)
    confidenceThreshold: 80,

    // 2. Mínimo absoluto de píxeles activos en lienzo 160x160 (1,800 px = ~7% del recuadro)
    // Previene que unos pocos píxeles dispersos o sombras activen una detección
    minSubjectPixels: 1800,

    // 3. Porcentaje mínimo de cobertura del recuadro (al menos 8.0% del visor)
    minCoveragePercent: 8.0,

    // 4. Margen de dominancia cromática sobre el segundo candidato (>= 15%)
    colorMarginThreshold: 15,
  };

  readonly TARGETS: Record<string, TargetPokemon> = {
    pikachu: {
      id: 25,
      pokedexId: 25,
      name: 'pikachu',
      displayName: 'Pikachu',
      types: ['electric'],
      referenceAsset: 'assets/ar-targets/pikachu.png',
      themeColor: '#FFCE4B',
    },
    charmander: {
      id: 4,
      pokedexId: 4,
      name: 'charmander',
      displayName: 'Charmander',
      types: ['fire'],
      referenceAsset: 'assets/ar-targets/charmander.png',
      themeColor: '#FA6555',
    },
    bulbasaur: {
      id: 1,
      pokedexId: 1,
      name: 'bulbasaur',
      displayName: 'Bulbasaur',
      types: ['grass', 'poison'],
      referenceAsset: 'assets/ar-targets/bulbasaur.png',
      themeColor: '#48D0B0',
    },
  };

  /**
   * Clasifica una imagen procesada en canvas analizando el perfil cromático aislado.
   */
  classifyCanvas(canvas: HTMLCanvasElement): ClassificationResult {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return {
        detected: false,
        pokemon: null,
        confidence: 0,
        scores: { pikachu: 0, charmander: 0, bulbasaur: 0, background: 100 },
        message: 'Alinee el Pokémon en el recuadro',
      };
    }

    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    return this.classifyImageData(imageData);
  }

  /**
   * Analiza los píxeles del cuadro guía con segmentación cromática inmune al brillo y reflejos de celulares.
   * Filtra fondo blanco del visor del móvil, reflejos especulares, marcos negros y ruido ambiental.
   */
  classifyImageData(imageData: ImageData): ClassificationResult {
    const { data, width, height } = imageData;
    const totalSampledPixels = width * height;

    let pikachuPixels = 0;
    let charmanderPixels = 0;
    let bulbasaurPixels = 0;
    let noisePixels = 0;
    let backgroundPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // 1. Descartar píxeles transparentes
      if (a < 50) {
        backgroundPixels++;
        continue;
      }

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      const sat = max === 0 ? 0 : delta / max;
      const val = max / 255;

      // 2. Filtro preciso de fondo blanco de pantalla / reflejos brillantes:
      // En blanco puro de pantalla celular R, G y B son prácticamente idénticos
      const isPureWhiteScreen =
        r >= 210 && g >= 210 && b >= 210 &&
        sat <= 0.12 &&
        Math.abs(r - b) <= 22 &&
        Math.abs(g - b) <= 22;

      if (isPureWhiteScreen) {
        backgroundPixels++;
        continue;
      }

      // 3. Filtro de marco negro del teléfono / sombras oscuras
      if (val <= 0.15) {
        backgroundPixels++;
        continue;
      }

      // 4. Filtro de Piel Humana (mano sosteniendo el celular):
      // Evita falsos positivos con dedos y manos en pantalla
      const isHumanSkin =
        r >= 130 && g >= 90 && b >= 70 &&
        r > g && g > b &&
        (r - g <= 46) &&
        (r - b <= 72) &&
        sat <= 0.38;

      if (isHumanSkin) {
        backgroundPixels++;
        continue;
      }

      // Cálculo de Matiz (Hue 0° - 360°)
      let hue = 0;
      if (delta !== 0) {
        if (max === r) {
          hue = ((g - b) / delta) % 6;
        } else if (max === g) {
          hue = (b - r) / delta + 2;
        } else {
          hue = (r - g) / delta + 4;
        }
        hue = Math.round(hue * 60);
        if (hue < 0) hue += 360;
      }

      // 5. Filtro de superficies de madera / fondos marrones neutros
      const isWoodSurface =
        val <= 0.65 &&
        r <= 165 &&
        hue >= 18 && hue <= 40 &&
        sat <= 0.48;

      if (isWoodSurface) {
        backgroundPixels++;
        continue;
      }

      // 6. Filtro de tonos neutros / gris ambiental (desaturados y sin contraste)
      if (sat < 0.15 && delta < 18) {
        backgroundPixels++;
        continue;
      }

      // -------------------------------------------------------------
      // EXTRACCIÓN DE CARACTERÍSTICAS CROMÁTICAS CALIBRADAS Y EQUILIBRADAS
      // -------------------------------------------------------------

      // 1. PIKACHU: Amarillo eléctrico canario
      // Compensado para brillo de pantalla celular (Red y Green altos, Blue marcadamente inferior)
      const isPikachuYellow =
        hue >= 30 && hue <= 74 &&
        r >= 105 && g >= 85 &&
        (r >= b + 20) && (g >= b + 14) &&
        (b <= 0.84 * Math.max(r, g)) &&
        sat >= 0.14;

      // Mejillas rojas de Pikachu
      const isPikachuCheek =
        (hue >= 345 || hue <= 15) &&
        r >= 135 && g <= 100 && b <= 100 &&
        sat >= 0.40;

      // 2. CHARMANDER: Naranja dragón brillante + vientre crema + cola de fuego
      // Fuego naranja calibrado: R domina claramente a G y B con tolerancia al lavado de pantalla
      const isCharmanderOrange =
        hue >= 8 && hue <= 38 &&
        r >= 135 &&
        (r >= g + 16) &&
        (r >= b + 26) &&
        (b <= 0.82 * r) &&
        sat >= 0.14;

      const isCharmanderBelly =
        hue >= 30 && hue <= 52 &&
        r >= 150 && g >= 120 && b >= 60 &&
        r >= g + 10 && g > b &&
        (r - b >= 45) &&
        sat >= 0.14 && sat <= 0.55;

      const isCharmanderTail =
        hue >= 8 && hue <= 55 &&
        r >= 185 && (r >= g + 16) && sat >= 0.35;

      // 3. BULBASAUR: Verde azulado / Turquesa / Cian vivo + bulbo vegetal definido
      // [CALIBRACIÓN ESTRICTA ANTI-FALSOS POSITIVOS]:
      // Bulbasaur en pantalla de celular es luminoso y saturado (val >= 0.44, g >= 110, b >= 95).
      // Se eliminó la regla permisiva de sombras tenues que confundía paredes frías, cables o fondos oscuros.
      const isBulbasaurTeal =
        hue >= 145 && hue <= 198 &&
        val >= 0.44 &&
        g >= 110 && b >= 95 &&
        (g >= r + 16 || b >= r + 14) &&
        sat >= 0.16;

      // Bulbo vegetal en el lomo: Verde follaje brillante definido
      const isBulbasaurBulb =
        hue >= 75 && hue <= 135 &&
        val >= 0.44 &&
        g >= 110 && (g >= r + 18) &&
        sat >= 0.16;

      if (isPikachuYellow || isPikachuCheek) {
        pikachuPixels++;
      } else if (isCharmanderOrange || isCharmanderBelly || isCharmanderTail) {
        charmanderPixels++;
      } else if (isBulbasaurTeal || isBulbasaurBulb) {
        bulbasaurPixels++;
      } else {
        noisePixels++;
      }
    }

    const totalSubjectPixels = pikachuPixels + charmanderPixels + bulbasaurPixels + noisePixels;
    const coveragePercent = (totalSubjectPixels / totalSampledPixels) * 100;

    // FILTRO 1: EMPTY CHECK - Marco sin Pokémon o sin suficiente presencia
    // Si la cantidad de píxeles no supera minSubjectPixels (1,800 px) o el 8% de cobertura, es fondo/vacío
    if (totalSubjectPixels < this.config.minSubjectPixels || coveragePercent < this.config.minCoveragePercent) {
      return {
        detected: false,
        pokemon: null,
        confidence: 0,
        scores: { pikachu: 0, charmander: 0, bulbasaur: 0, background: 100 },
        message: 'Buscando Pokémon en el recuadro...',
        debugInfo: { matchingPixels: 0, totalSubjectPixels, coveragePercent },
      };
    }

    // Clasificación y orden de candidatos
    const candidates = [
      { key: 'pikachu', pixels: pikachuPixels, target: this.TARGETS['pikachu'] },
      { key: 'charmander', pixels: charmanderPixels, target: this.TARGETS['charmander'] },
      { key: 'bulbasaur', pixels: bulbasaurPixels, target: this.TARGETS['bulbasaur'] },
    ].sort((a, b) => b.pixels - a.pixels);

    const winner = candidates[0];
    const runnerUp = candidates[1];

    // Métricas de pureza y dominancia dentro del sujeto visible
    const purityScore = totalSubjectPixels > 0 ? (winner.pixels / totalSubjectPixels) : 0;
    const dominanceScore = (winner.pixels + runnerUp.pixels) > 0 ? (winner.pixels / (winner.pixels + runnerUp.pixels)) : 0;
    const calculatedConfidence = Math.min(99, Math.round((purityScore * 0.45 + dominanceScore * 0.55) * 100));

    const pikaConfidence = Math.round((pikachuPixels / totalSubjectPixels) * 100);
    const charConfidence = Math.round((charmanderPixels / totalSubjectPixels) * 100);
    const bulbConfidence = Math.round((bulbasaurPixels / totalSubjectPixels) * 100);
    const bgConfidence = Math.round((noisePixels / totalSubjectPixels) * 100);

    const scores = {
      pikachu: pikaConfidence,
      charmander: charConfidence,
      bulbasaur: bulbConfidence,
      background: bgConfidence,
    };

    // FILTRO 2: Certeza mínima estricta (>= 80%), dominancia categórica (>= 80%) y pureza mínima (>= 45%)
    const isConfirmed =
      calculatedConfidence >= this.config.confidenceThreshold &&
      winner.pixels >= this.config.minSubjectPixels &&
      dominanceScore >= 0.80 &&
      purityScore >= 0.45;

    if (isConfirmed) {
      return {
        detected: true,
        pokemon: winner.target,
        confidence: calculatedConfidence,
        scores,
        message: `¡${winner.target.displayName} detectado con ${calculatedConfidence}% de coincidencia!`,
        debugInfo: { matchingPixels: winner.pixels, totalSubjectPixels, coveragePercent },
      };
    }

    return {
      detected: false,
      pokemon: null,
      confidence: calculatedConfidence,
      scores,
      message: 'Buscando Pokémon en el recuadro...',
      debugInfo: { matchingPixels: winner.pixels, totalSubjectPixels, coveragePercent },
    };
  }

  /**
   * Carga una imagen de URL o dataURL en un canvas y la clasifica
   */
  classifyImageUrl(url: string): Promise<ClassificationResult> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 240;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 240, 240);
          resolve(this.classifyCanvas(canvas));
        } else {
          resolve({
            detected: false,
            pokemon: null,
            confidence: 0,
            scores: { pikachu: 0, charmander: 0, bulbasaur: 0, background: 100 },
            message: 'Error al inicializar canvas para la imagen.',
          });
        }
      };
      img.onerror = () => {
        resolve({
          detected: false,
          pokemon: null,
          confidence: 0,
          scores: { pikachu: 0, charmander: 0, bulbasaur: 0, background: 100 },
          message: 'Error al cargar la imagen de referencia.',
        });
      };
      img.src = url;
    });
  }
}
