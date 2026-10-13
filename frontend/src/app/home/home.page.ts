import { Component, OnInit, OnDestroy, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonSearchbar,
  IonFab,
  IonFabButton,
  IonModal,
  IonSpinner,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonSkeletonText,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonRefresher,
  IonRefresherContent,
  AlertController,
  ToastController,
  ModalController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  searchOutline,
  addOutline,
  trashOutline,
  createOutline,
  sparklesOutline,
  flashOutline,
  barbellOutline,
  resizeOutline,
  chevronForwardOutline,
  alertCircleOutline,
  refreshOutline,
  checkmarkCircleOutline,
  closeOutline,
  filterOutline,
  heartOutline,
  shieldOutline,
  flameOutline,
  speedometerOutline,
  eyeOutline,
  cloudUploadOutline,
  closeCircleOutline,
  cameraOutline,
  cameraReverseOutline,
  scanOutline,
  checkmarkDoneOutline,
} from 'ionicons/icons';
import { PokemonService, Pokemon } from '../services/pokemon.service';
import {
  PokemonClassifierService,
  ClassificationResult,
  TargetPokemon,
} from '../services/pokemon-classifier.service';
import { Haptics, NotificationType } from '@capacitor/haptics';

export interface TypeFilterItem {
  key: string;
  label: string;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonButton,
    IonIcon,
    IonSearchbar,
    IonFab,
    IonFabButton,
    IonModal,
    IonSpinner,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonSkeletonText,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonRefresher,
    IonRefresherContent,
  ],
})
export class HomePage implements OnInit, OnDestroy {
  pokemons = signal<Pokemon[]>([]);
  currentPage = signal<number>(1);
  limit = 20;
  totalPages = signal<number>(1);
  totalPokemons = signal<number>(0);
  isLoading = signal<boolean>(true);
  hasError = signal<boolean>(false);
  errorMessage = signal<string>('');

  // Búsqueda y Filtrado (HU-04)
  searchQuery = signal<string>('');
  selectedType = signal<string>('all');
  isSearching = signal<boolean>(false);
  isSearchActive = signal<boolean>(false);
  searchResultCount = signal<number>(0);

  // Lista de tipos para los chips de filtrado
  typeFilters: TypeFilterItem[] = [
    { key: 'all', label: 'Todos' },
    { key: 'grass', label: 'Planta' },
    { key: 'fire', label: 'Fuego' },
    { key: 'water', label: 'Agua' },
    { key: 'electric', label: 'Eléctrico' },
    { key: 'poison', label: 'Veneno' },
    { key: 'bug', label: 'Bicho' },
    { key: 'flying', label: 'Volador' },
    { key: 'normal', label: 'Normal' },
    { key: 'ground', label: 'Tierra' },
    { key: 'fairy', label: 'Hada' },
    { key: 'fighting', label: 'Lucha' },
    { key: 'psychic', label: 'Psíquico' },
    { key: 'rock', label: 'Roca' },
    { key: 'steel', label: 'Acero' },
    { key: 'ice', label: 'Hielo' },
    { key: 'ghost', label: 'Fantasma' },
    { key: 'dragon', label: 'Dragón' },
    { key: 'dark', label: 'Siniestro' },
  ];

  // Modal de Importación (HU-05)
  isImportModalOpen = signal<boolean>(false);
  importInput = signal<string>('');
  isImportSearching = signal<boolean>(false);
  isImportSubmitting = signal<boolean>(false);
  previewPokemon = signal<Pokemon | null>(null);
  importError = signal<string | null>(null);

  // Reconocimiento Visual / Cámara AR (3 Pokémon: Pikachu, Charmander, Bulbasaur)
  readonly REQUIRED_CONFIRMATIONS = 2; // 2 lecturas sostenidas (~400ms) para respuesta ultra ágil inmune a temblores leves
  readonly SCAN_INTERVAL_MS = 200;      // 5 análisis por segundo para máxima velocidad y fluidez

  isScannerModalOpen = signal<boolean>(false);
  isCameraActive = signal<boolean>(false);
  isScanning = signal<boolean>(false);
  scannerFacing = signal<'environment' | 'user'>('environment');
  scannerResult = signal<ClassificationResult | null>(null);
  scannerError = signal<string | null>(null);
  scannedPokemonDetail = signal<Pokemon | null>(null);
  isLoadingScannedDetail = signal<boolean>(false);

  // Estados de estabilidad, descarte de vacíos y confirmación continua
  matchProgress = signal<number>(0);             // Progreso de confirmación: 0 a 2
  isConfirmed = signal<boolean>(false);           // Confirmado tras alcanzar REQUIRED_CONFIRMATIONS
  detectedCandidate = signal<TargetPokemon | null>(null);
  currentStatusText = signal<string>('Alinee el Pokémon en el recuadro');
  private activeCandidateName: string | null = null;
  private consecutiveMatches = 0;
  private autoScanInterval: any = null;
  private mediaStream: MediaStream | null = null;

  skeletonItems = Array(6).fill(0);

  constructor(
    private pokemonService: PokemonService,
    public classifierService: PokemonClassifierService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController
  ) {
    addIcons({
      searchOutline,
      addOutline,
      trashOutline,
      createOutline,
      sparklesOutline,
      flashOutline,
      barbellOutline,
      resizeOutline,
      chevronForwardOutline,
      alertCircleOutline,
      refreshOutline,
      checkmarkCircleOutline,
      closeOutline,
      filterOutline,
      heartOutline,
      shieldOutline,
      flameOutline,
      speedometerOutline,
      eyeOutline,
      cloudUploadOutline,
      closeCircleOutline,
      cameraOutline,
      cameraReverseOutline,
      scanOutline,
      checkmarkDoneOutline,
    });
  }

  ngOnInit() {
    this.loadPokemons();
  }

  ngOnDestroy() {
    this.stopCamera();
  }

  /**
   * Carga el listado paginado inicial (HU-02)
   */
  loadPokemons(event?: any, isRefresh: boolean = false) {
    if (isRefresh) {
      this.currentPage.set(1);
      this.pokemons.set([]);
    }

    this.isLoading.set(this.pokemons().length === 0);
    this.hasError.set(false);
    this.cdr.detectChanges();

    this.pokemonService.getPokemons(this.currentPage(), this.limit).subscribe({
      next: (response) => {
        if (isRefresh) {
          this.pokemons.set(response.data);
        } else {
          this.pokemons.update((prev) => [...prev, ...response.data]);
        }

        this.totalPages.set(response.totalPages);
        this.totalPokemons.set(response.total);
        this.isLoading.set(false);

        if (event) {
          event.target.complete();
          if (this.currentPage() >= this.totalPages() && event.target.disabled !== undefined) {
            event.target.disabled = true;
          }
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando Pokémon:', err);
        this.isLoading.set(false);
        this.hasError.set(true);
        this.errorMessage.set('No se pudo conectar con el servidor backend ni con PokéAPI.');
        if (event) {
          event.target.complete();
        }
        this.cdr.detectChanges();
      },
    });
  }

  /**
   * HU-04: Ejecutar búsqueda y filtrado reactivo
   */
  onSearchInput(event: any) {
    const value = event?.target?.value ?? '';
    this.searchQuery.set(value);
    this.executeSearch();
  }

  selectTypeFilter(typeKey: string) {
    if (this.selectedType() === typeKey) {
      this.selectedType.set('all');
    } else {
      this.selectedType.set(typeKey);
    }
    this.executeSearch();
  }

  executeSearch() {
    const query = this.searchQuery().trim();
    const type = this.selectedType();

    if (!query && type === 'all') {
      this.isSearchActive.set(false);
      this.currentPage.set(1);
      this.loadPokemons(null, true);
      return;
    }

    this.isSearchActive.set(true);
    this.isSearching.set(true);
    this.cdr.detectChanges();

    this.pokemonService.searchPokemons(query, type === 'all' ? '' : type).subscribe({
      next: (results) => {
        this.pokemons.set(results);
        this.searchResultCount.set(results.length);
        this.isSearching.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error en búsqueda:', err);
        this.pokemons.set([]);
        this.searchResultCount.set(0);
        this.isSearching.set(false);
        this.cdr.detectChanges();
      },
    });
  }

  clearFilters() {
    this.searchQuery.set('');
    this.selectedType.set('all');
    this.isSearchActive.set(false);
    this.loadPokemons(null, true);
  }

  onIonInfinite(event: any) {
    if (this.isSearchActive()) {
      event.target.complete();
      event.target.disabled = true;
      return;
    }

    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update((p) => p + 1);
      this.loadPokemons(event);
    } else {
      event.target.complete();
      event.target.disabled = true;
    }
  }

  handleRefresh(event: any) {
    if (this.isSearchActive()) {
      this.executeSearch();
      if (event) event.target.complete();
    } else {
      this.loadPokemons(event, true);
    }
  }

  // ==========================================
  // HU-05: MODAL DE IMPORTACIÓN DESDE POKÉAPI
  // ==========================================
  openImportModal() {
    this.importInput.set('');
    this.previewPokemon.set(null);
    this.importError.set(null);
    this.isImportModalOpen.set(true);
  }

  closeImportModal() {
    this.isImportModalOpen.set(false);
    this.previewPokemon.set(null);
    this.importError.set(null);
  }

  fetchPokeApiPreview() {
    const rawVal = this.importInput().trim();
    if (!rawVal) {
      this.importError.set('Escribe el nombre o número de Pokédex');
      return;
    }

    this.isImportSearching.set(true);
    this.importError.set(null);
    this.previewPokemon.set(null);
    this.cdr.detectChanges();

    this.pokemonService.peekPokeApi(rawVal).subscribe({
      next: (preview) => {
        this.previewPokemon.set(preview);
        this.isImportSearching.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn('Error al buscar preview en PokéAPI:', err);
        this.importError.set(`No se encontró "${rawVal}" en PokéAPI. Verifica el nombre o número.`);
        this.isImportSearching.set(false);
        this.cdr.detectChanges();
      },
    });
  }

  confirmImport() {
    const rawVal = this.importInput().trim();
    if (!rawVal) return;

    this.isImportSubmitting.set(true);
    this.importError.set(null);
    this.cdr.detectChanges();

    this.pokemonService.importPokemon(rawVal).subscribe({
      next: async (res) => {
        this.isImportSubmitting.set(false);
        this.closeImportModal();

        // Agregar al inicio del listado local
        if (res.pokemon) {
          this.pokemons.update((prev) => [res.pokemon, ...prev.filter((p) => p.pokedexId !== res.pokemon.pokedexId)]);
          this.totalPokemons.update((t) => t + 1);
        }

        const toast = await this.toastCtrl.create({
          message: res.message || `¡${res.pokemon?.name || rawVal} importado con éxito!`,
          duration: 3500,
          color: 'success',
          position: 'top',
          icon: 'checkmark-circle-outline',
        });
        await toast.present();
        this.cdr.detectChanges();
      },
      error: async (err) => {
        this.isImportSubmitting.set(false);
        const errMsg = err?.error?.message || 'Error al importar el Pokémon.';
        this.importError.set(errMsg);
        this.cdr.detectChanges();
      },
    });
  }

  // ==========================================
  // HU-07: ELIMINACIÓN DE POKÉMON CON CONFIRMACIÓN
  // ==========================================
  async confirmDelete(pokemon: Pokemon, event: Event) {
    event.stopPropagation(); // Evita abrir la ficha de detalle

    const alert = await this.alertCtrl.create({
      header: 'Eliminar Pokémon',
      subHeader: `#${pokemon.pokedexId} - ${pokemon.name.toUpperCase()}`,
      message: `¿Estás seguro de que deseas eliminar a <strong>${pokemon.name}</strong> de tu Pokédex local? Esta acción no se puede deshacer.`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'alert-btn-cancel',
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          cssClass: 'alert-btn-delete',
          handler: () => {
            this.executeDelete(pokemon);
          },
        },
      ],
    });

    await alert.present();
  }

  private executeDelete(pokemon: Pokemon) {
    this.pokemonService.deletePokemon(pokemon.id || pokemon.pokedexId).subscribe({
      next: async (res) => {
        // Remover de la vista reactivamente con animación
        this.pokemons.update((prev) => prev.filter((p) => p.id !== pokemon.id && p.pokedexId !== pokemon.pokedexId));
        this.totalPokemons.update((t) => Math.max(0, t - 1));

        const toast = await this.toastCtrl.create({
          message: res.message || `Pokémon ${pokemon.name} eliminado de la Pokédex.`,
          duration: 3000,
          color: 'dark',
          position: 'top',
          icon: 'trash-outline',
        });
        await toast.present();
        this.cdr.detectChanges();
      },
      error: async (err) => {
        console.error('Error al eliminar Pokémon:', err);
        const toast = await this.toastCtrl.create({
          message: err?.error?.message || 'No se pudo eliminar el Pokémon.',
          duration: 3500,
          color: 'danger',
          position: 'top',
          icon: 'alert-circle-outline',
        });
        await toast.present();
      },
    });
  }

  // ==========================================
  // RECONOCIMIENTO VISUAL / CÁMARA AR OPTIMIZADO
  // ==========================================
  /**
   * Reinicia por completo el ciclo de detección del escáner:
   * Limpia el resultado actual, vacía acumuladores y buffers de frames,
   * restablece la interfaz al estado neutro y reanuda el bucle en tiempo real inmediatamente.
   */
  resetScan() {
    this.isConfirmed.set(false);
    this.isScanning.set(false);
    this.scannerResult.set(null);
    this.scannedPokemonDetail.set(null);
    this.isLoadingScannedDetail.set(false);

    this.matchProgress.set(0);
    this.detectedCandidate.set(null);
    this.activeCandidateName = null;
    this.consecutiveMatches = 0;
    this.scannerError.set(null);
    this.currentStatusText.set('Buscando Pokémon en el recuadro...');

    // Reanudar inmediatamente el bucle de análisis continuo si la cámara sigue encendida
    if (this.isCameraActive()) {
      this.startAutoScanLoop();
    }
    this.cdr.detectChanges();
  }

  scanAgain() {
    this.resetScan();
  }

  onShutterClick() {
    if (this.isConfirmed()) {
      this.resetScan();
    } else {
      this.captureAndClassify(false);
    }
  }

  openCameraScanner() {
    this.resetScan();
    this.currentStatusText.set('Buscando Pokémon en el recuadro...');
    this.isScannerModalOpen.set(true);
    this.startCamera();
  }

  async closeCameraScanner() {
    this.stopAutoScanLoop();
    this.stopCamera();
    this.isScannerModalOpen.set(false);
    this.resetScan();

    try {
      const topModal = await this.modalCtrl.getTop();
      if (topModal) {
        await topModal.dismiss();
      }
    } catch (e) {
      // Manejar silenciosamente si el modal ya fue cerrado
    }
    this.cdr.detectChanges();
  }

  async startCamera() {
    this.isScanning.set(false);
    this.scannerError.set(null);
    this.cdr.detectChanges();

    try {
      this.stopCamera();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('La API de cámara no es soportada en este navegador o entorno.');
      }

      // Restricciones de alta resolución (1080p ideal / 720p mínimo) y cámara trasera
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: this.scannerFacing() },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.mediaStream = stream;
      this.isCameraActive.set(true);

      // Activar enfoque continuo (Continuous Autofocus) si la cámara lo soporta
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as any;
        if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
          videoTrack
            .applyConstraints({
              advanced: [{ focusMode: 'continuous' } as any],
            })
            .catch((e) => console.warn('Aviso: enfoque continuo no configurable:', e));
        }
      }

      setTimeout(() => {
        const video = document.getElementById('scannerVideo') as HTMLVideoElement;
        if (video) {
          video.srcObject = stream;
          video.play().catch((e) => console.warn('Aviso reproducción video:', e));
          this.currentStatusText.set('Estabilizando sensor de cámara...');
          this.cdr.detectChanges();

          // Retraso de estabilización de 1.2 segundos para balance de blancos y auto-exposición inicial
          setTimeout(() => {
            if (this.isCameraActive() && !this.isConfirmed()) {
              this.currentStatusText.set('Buscando Pokémon en el recuadro...');
              this.startAutoScanLoop();
              this.cdr.detectChanges();
            }
          }, 1200);
        }
      }, 150);
    } catch (err: any) {
      console.warn('Error al iniciar la cámara en alta resolución:', err);
      // Fallback a resolución estándar si el dispositivo no soporta 720p/1080p
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: this.scannerFacing() },
          audio: false,
        });
        this.mediaStream = fallbackStream;
        this.isCameraActive.set(true);
        setTimeout(() => {
          const video = document.getElementById('scannerVideo') as HTMLVideoElement;
          if (video) {
            video.srcObject = fallbackStream;
            video.play().catch((e) => console.warn('Aviso reproducción video:', e));
            this.currentStatusText.set('Estabilizando sensor de cámara...');
            this.cdr.detectChanges();

            setTimeout(() => {
              if (this.isCameraActive() && !this.isConfirmed()) {
                this.currentStatusText.set('Buscando Pokémon en el recuadro...');
                this.startAutoScanLoop();
                this.cdr.detectChanges();
              }
            }, 1200);
          }
        }, 150);
      } catch (fallbackErr) {
        this.isCameraActive.set(false);
        this.scannerError.set(
          'No se pudo acceder a la cámara. Concede los permisos necesarios o prueba con los objetivos de muestra abajo.'
        );
      }
    }
    this.cdr.detectChanges();
  }

  stopCamera() {
    this.stopAutoScanLoop();
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
      } catch (e) {
        console.warn('Error al detener tracks de cámara:', e);
      }
      this.mediaStream = null;
    }
    const video = document.getElementById('scannerVideo') as HTMLVideoElement;
    if (video) {
      video.srcObject = null;
    }
    this.isCameraActive.set(false);
  }

  toggleCameraFacing() {
    const nextFacing = this.scannerFacing() === 'environment' ? 'user' : 'environment';
    this.scannerFacing.set(nextFacing);
    this.startCamera();
  }

  private startAutoScanLoop() {
    this.stopAutoScanLoop();
    this.autoScanInterval = setInterval(() => {
      if (this.isCameraActive() && !this.isScanning() && !this.isConfirmed()) {
        this.captureAndClassify(true);
      }
    }, this.SCAN_INTERVAL_MS);
  }

  private stopAutoScanLoop() {
    if (this.autoScanInterval) {
      clearInterval(this.autoScanInterval);
      this.autoScanInterval = null;
    }
  }

  /**
   * Recorta exactamente la región visible dentro del marco de la mira (reticle)
   * mapeando las coordenadas del DOM al espacio intrínseco del sensor de la cámara.
   * Utiliza resolución ultra-rápida de 160x160 para eliminar lag y soportar temblores.
   */
  captureAndClassify(isAuto: boolean = false) {
    const video = document.getElementById('scannerVideo') as HTMLVideoElement;
    const reticle = document.getElementById('scannerReticle') as HTMLElement;
    const canvas = document.getElementById('scannerCanvas') as HTMLCanvasElement;

    if (!video || !canvas || video.readyState < 2) {
      if (!isAuto) this.scannerError.set('La cámara aún se está inicializando. Intenta de nuevo.');
      return;
    }

    if (!isAuto) {
      this.isScanning.set(true);
      this.cdr.detectChanges();
    }

    const vWidth = video.videoWidth || 1280;
    const vHeight = video.videoHeight || 720;
    const videoRect = video.getBoundingClientRect();
    const reticleRect = reticle ? reticle.getBoundingClientRect() : null;

    let sourceX = 0;
    let sourceY = 0;
    let sourceW = vWidth;
    let sourceH = vHeight;

    // Cálculo geométrico de precisión: Recortar ÚNICAMENTE lo que el usuario ve dentro de la mira
    if (reticleRect && videoRect.width > 0 && videoRect.height > 0) {
      const scale = Math.max(videoRect.width / vWidth, videoRect.height / vHeight);
      const renderedW = vWidth * scale;
      const renderedH = vHeight * scale;
      const offsetX = (videoRect.width - renderedW) / 2;
      const offsetY = (videoRect.height - renderedH) / 2;

      const relX = reticleRect.left - videoRect.left - offsetX;
      const relY = reticleRect.top - videoRect.top - offsetY;

      sourceX = Math.max(0, Math.floor(relX / scale));
      sourceY = Math.max(0, Math.floor(relY / scale));
      sourceW = Math.min(vWidth - sourceX, Math.floor(reticleRect.width / scale));
      sourceH = Math.min(vHeight - sourceY, Math.floor(reticleRect.height / scale));
    } else {
      const cropSize = Math.min(vWidth, vHeight) * 0.75;
      sourceX = (vWidth - cropSize) / 2;
      sourceY = (vHeight - cropSize) / 2;
      sourceW = cropSize;
      sourceH = cropSize;
    }

    // Resolución de análisis instantánea (160x160): procesamiento ultra ligero (~2ms)
    canvas.width = 160;
    canvas.height = 160;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      if (!isAuto) this.isScanning.set(false);
      return;
    }

    ctx.drawImage(video, sourceX, sourceY, sourceW, sourceH, 0, 0, 160, 160);
    const result = this.classifierService.classifyCanvas(canvas);

    // -------------------------------------------------------------
    // MOTOR DE ESTABILIDAD: CONFIRMACIÓN ÁGIL (2 LECTURAS) TOLERANTE A TEMBLORES
    // -------------------------------------------------------------
    if (result.detected && result.pokemon) {
      if (this.activeCandidateName === result.pokemon.name) {
        this.consecutiveMatches++;
      } else {
        this.activeCandidateName = result.pokemon.name;
        this.consecutiveMatches = 1;
      }

      this.detectedCandidate.set(result.pokemon);
      this.matchProgress.set(Math.min(this.REQUIRED_CONFIRMATIONS, this.consecutiveMatches));
      this.currentStatusText.set(
        `Analizando a ${result.pokemon.displayName} (${this.consecutiveMatches}/${this.REQUIRED_CONFIRMATIONS})...`
      );

      // Confirmación inmediata tras 2 lecturas sostenidas (~400ms)
      if (this.consecutiveMatches >= this.REQUIRED_CONFIRMATIONS) {
        this.isConfirmed.set(true);
        this.scannerResult.set(result);
        this.currentStatusText.set(`¡${result.pokemon.displayName} detectado! Cargando datos...`);
        this.stopAutoScanLoop();
        this.triggerHapticFeedback();
        this.loadScannedPokemonDetail(result.pokemon.pokedexId);
      }
    } else {
      // Tolerancia a temblor de mano: decae 1 paso en vez de reiniciarse drásticamente
      if (this.consecutiveMatches > 0) {
        this.consecutiveMatches--;
        this.matchProgress.set(this.consecutiveMatches);
      }

      if (this.consecutiveMatches === 0) {
        this.activeCandidateName = null;
        this.detectedCandidate.set(null);
        this.currentStatusText.set('Buscando Pokémon en el recuadro...');
      }

      if (!isAuto && !this.isConfirmed()) {
        this.scannerResult.set(result);
      }
    }

    if (!isAuto) {
      this.isScanning.set(false);
    }
    this.cdr.detectChanges();
  }

  /**
   * Emite feedback háptico (vibración física) al confirmar un Pokémon
   */
  private async triggerHapticFeedback() {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      if ('vibrate' in navigator) {
        navigator.vibrate([80, 40, 80]);
      }
    }
  }

  private loadScannedPokemonDetail(pokedexId: number) {
    this.isLoadingScannedDetail.set(true);
    this.cdr.detectChanges();

    this.pokemonService.getPokemonById(pokedexId).subscribe({
      next: (pokemon) => {
        this.scannedPokemonDetail.set(pokemon);
        this.isLoadingScannedDetail.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn('No se pudo cargar detalle completo de SQLite/PokéAPI:', err);
        this.isLoadingScannedDetail.set(false);
        this.cdr.detectChanges();
      },
    });
  }

  async goToScannedPokemonDetail() {
    const targetId = this.scannedPokemonDetail()?.pokedexId || this.scannerResult()?.pokemon?.pokedexId;
    if (targetId) {
      await this.closeCameraScanner();
      this.router.navigate(['/pokemon-detail', targetId]);
    }
  }

  // ==========================================
  // NAVEGACIÓN Y UTILIDADES VISUALES
  // ==========================================
  goToDetail(pokemon: Pokemon) {
    this.router.navigate(['/pokemon-detail', pokemon.pokedexId || pokemon.id]);
  }

  formatPokedexId(id: number): string {
    if (!id) return '#000';
    return '#' + id.toString().padStart(3, '0');
  }

  onImageError(event: any, pokedexId: number) {
    event.target.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokedexId}.png`;
  }

  getTypeClass(type: string): string {
    if (!type) return 'type-normal';
    return `type-${type.toLowerCase()}`;
  }

  getStatPercent(val: number = 0): number {
    return Math.min(100, Math.round((val / 255) * 100));
  }
}
