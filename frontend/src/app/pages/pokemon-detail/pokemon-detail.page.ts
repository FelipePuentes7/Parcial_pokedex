import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonGrid,
  IonRow,
  IonCol,
  IonSpinner,
  IonButton,
  IonIcon,
  IonModal,
  IonRange,
  AlertController,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  barbellOutline,
  resizeOutline,
  flashOutline,
  sparklesOutline,
  alertCircleOutline,
  refreshOutline,
  checkmarkCircleOutline,
  createOutline,
  trashOutline,
  saveOutline,
  closeOutline,
  heartOutline,
  shieldOutline,
  flameOutline,
  speedometerOutline,
  statsChartOutline,
  trophyOutline,
} from 'ionicons/icons';
import { PokemonService, Pokemon } from '../../services/pokemon.service';

export interface PokemonEditModel {
  name: string;
  height: number;
  weight: number;
  hp: number;
  attack: number;
  defense: number;
  special_attack: number;
  special_defense: number;
  speed: number;
}

@Component({
  selector: 'app-pokemon-detail',
  templateUrl: './pokemon-detail.page.html',
  styleUrls: ['./pokemon-detail.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonBackButton,
    IonGrid,
    IonRow,
    IonCol,
    IonSpinner,
    IonButton,
    IonIcon,
    IonModal,
    IonRange,
  ],
})
export class PokemonDetailPage implements OnInit {
  pokemon = signal<Pokemon | null>(null);
  pokemonIdParam: string | null = null;
  isLoading = signal<boolean>(true);
  hasError = signal<boolean>(false);
  errorMessage = signal<string>('');

  // Modal de Edición (HU-06)
  isEditModalOpen = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  editForm: PokemonEditModel = {
    name: '',
    height: 0,
    weight: 0,
    hp: 50,
    attack: 50,
    defense: 50,
    special_attack: 50,
    special_defense: 50,
    speed: 50,
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pokemonService: PokemonService,
    private cdr: ChangeDetectorRef,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {
    addIcons({
      arrowBackOutline,
      barbellOutline,
      resizeOutline,
      flashOutline,
      sparklesOutline,
      alertCircleOutline,
      refreshOutline,
      checkmarkCircleOutline,
      createOutline,
      trashOutline,
      saveOutline,
      closeOutline,
      heartOutline,
      shieldOutline,
      flameOutline,
      speedometerOutline,
      statsChartOutline,
      trophyOutline,
    });
  }

  ngOnInit() {
    this.pokemonIdParam = this.route.snapshot.paramMap.get('id');
    if (this.pokemonIdParam) {
      this.fetchPokemonDetail(this.pokemonIdParam);
    } else {
      this.isLoading.set(false);
      this.hasError.set(true);
      this.errorMessage.set('No se especificó un ID de Pokémon válido.');
      this.cdr.detectChanges();
    }
  }

  /**
   * HU-03: Cargar información detallada del Pokémon
   */
  fetchPokemonDetail(id: string | number) {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.cdr.detectChanges();

    this.pokemonService.getPokemonById(id).subscribe({
      next: (data) => {
        this.pokemon.set(data);
        this.isLoading.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al obtener detalle del Pokémon:', err);
        this.isLoading.set(false);
        this.hasError.set(true);
        this.errorMessage.set(err?.error?.message || 'No se pudo cargar la información del Pokémon.');
        this.cdr.detectChanges();
      },
    });
  }

  // ==========================================
  // HU-06: EDICIÓN DE ESTADÍSTICAS Y ATRIBUTOS
  // ==========================================
  openEditModal() {
    const current = this.pokemon();
    if (!current) return;

    this.editForm = {
      name: current.name,
      height: current.height,
      weight: current.weight,
      hp: current.hp || 50,
      attack: current.attack || 50,
      defense: current.defense || 50,
      special_attack: current.special_attack || 50,
      special_defense: current.special_defense || 50,
      speed: current.speed || 50,
    };

    this.isEditModalOpen.set(true);
  }

  closeEditModal() {
    this.isEditModalOpen.set(false);
  }

  savePokemonEdits() {
    const current = this.pokemon();
    if (!current) return;

    this.isSaving.set(true);
    this.cdr.detectChanges();

    const payload: Partial<Pokemon> = {
      name: this.editForm.name.trim().toLowerCase(),
      height: Number(this.editForm.height),
      weight: Number(this.editForm.weight),
      hp: Number(this.editForm.hp),
      attack: Number(this.editForm.attack),
      defense: Number(this.editForm.defense),
      special_attack: Number(this.editForm.special_attack),
      special_defense: Number(this.editForm.special_defense),
      speed: Number(this.editForm.speed),
    };

    this.pokemonService.updatePokemon(current.id || current.pokedexId, payload).subscribe({
      next: async (res) => {
        this.isSaving.set(false);
        this.closeEditModal();

        // Actualizar el estado reactivo inmediatamente
        if (res.pokemon) {
          this.pokemon.set(res.pokemon);
        } else {
          this.pokemon.update((prev) => (prev ? { ...prev, ...payload } : null));
        }

        const toast = await this.toastCtrl.create({
          message: res.message || '¡Estadísticas actualizadas con éxito!',
          duration: 3000,
          color: 'success',
          position: 'top',
          icon: 'checkmark-circle-outline',
        });
        await toast.present();
        this.cdr.detectChanges();
      },
      error: async (err) => {
        this.isSaving.set(false);
        console.error('Error al actualizar Pokémon:', err);
        const toast = await this.toastCtrl.create({
          message: err?.error?.message || 'Error al guardar los cambios.',
          duration: 3500,
          color: 'danger',
          position: 'top',
          icon: 'alert-circle-outline',
        });
        await toast.present();
        this.cdr.detectChanges();
      },
    });
  }

  // ==========================================
  // HU-07: ELIMINACIÓN DE POKÉMON CON CONFIRMACIÓN
  // ==========================================
  async confirmDelete() {
    const current = this.pokemon();
    if (!current) return;

    const alert = await this.alertCtrl.create({
      header: 'Eliminar Pokémon',
      subHeader: `#${current.pokedexId} - ${current.name.toUpperCase()}`,
      message: `¿Estás seguro de que deseas eliminar permanentemente a <strong>${current.name}</strong> de tu Pokédex?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.executeDelete();
          },
        },
      ],
    });

    await alert.present();
  }

  private executeDelete() {
    const current = this.pokemon();
    if (!current) return;

    this.pokemonService.deletePokemon(current.id || current.pokedexId).subscribe({
      next: async (res) => {
        const toast = await this.toastCtrl.create({
          message: res.message || `Pokémon ${current.name} eliminado de la Pokédex.`,
          duration: 3000,
          color: 'dark',
          position: 'top',
          icon: 'trash-outline',
        });
        await toast.present();
        this.router.navigate(['/home']);
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
  // UTILIDADES Y CÁLCULOS DE ESTADÍSTICAS
  // ==========================================
  getTotalStats(): number {
    const p = this.pokemon();
    if (!p) return 0;
    return (p.hp || 0) + (p.attack || 0) + (p.defense || 0) + (p.special_attack || 0) + (p.special_defense || 0) + (p.speed || 0);
  }

  getEditTotalStats(): number {
    return (
      (this.editForm.hp || 0) +
      (this.editForm.attack || 0) +
      (this.editForm.defense || 0) +
      (this.editForm.special_attack || 0) +
      (this.editForm.special_defense || 0) +
      (this.editForm.speed || 0)
    );
  }

  getStatPercent(val: number = 0): number {
    return Math.min(100, Math.round((val / 255) * 100));
  }

  onImageError(event: any, pokedexId?: number) {
    if (pokedexId) {
      event.target.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokedexId}.png`;
    }
  }

  retry() {
    if (this.pokemonIdParam) {
      this.fetchPokemonDetail(this.pokemonIdParam);
    }
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  formatPokedexId(id?: number): string {
    if (!id) return '#000';
    return '#' + id.toString().padStart(3, '0');
  }

  getTypeClass(type?: string): string {
    if (!type) return 'type-normal';
    return `type-${type.toLowerCase()}`;
  }
}
