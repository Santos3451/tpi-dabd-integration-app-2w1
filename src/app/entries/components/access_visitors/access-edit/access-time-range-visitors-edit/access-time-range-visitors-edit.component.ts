import { ChangeDetectorRef, Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import {  AccessAllowedDay, AccessAuthRange, AccessDay, AccessDay2, AccessUser } from '../../../../models/access-visitors/access-visitors-models';
import Swal from 'sweetalert2';
import { Subject } from 'rxjs';
import { AccessVisitorsEditServiceService } from '../../../../services/access_visitors/access-visitors-edit/access-visitors-edit-service/access-visitors-edit-service.service';
import { AccessVisitorsEditServiceHttpClientService } from '../../../../services/access_visitors/access-visitors-edit/access-visitors-edit-service-http-service/access-visitors-edit-service-http-client.service';
import { AccessApiAllowedDay, AccessAuthRangeInfoDto2 } from '../../../../models/access-visitors/access-VisitorsModels';
import { AuthService } from '../../../../../users/users-servicies/auth.service';
import { AccessVisitorsRegisterServiceService } from '../../../../services/access_visitors/access-visitors-register/access-visitors-register-service/access-visitors-register-service.service';

@Component({
  selector: 'app-access-time-range-visitors-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './access-time-range-visitors-edit.component.html',
  styleUrl: './access-time-range-visitors-edit.component.css'
})
export class AccessTimeRangeVisitorsEditComponent implements OnInit {
  private userId = 0;
  @Output() rangeSelected = new EventEmitter<{ init_date: string, end_date: string, allowedDays: any[] }>();


  selectedRange = {
    init_date: '',
    end_date: '',
    allowedDays: []
  };

  onRangeChange() {
    this.rangeSelected.emit(this.selectedRange);
  }


  @Output() selectedUser = new EventEmitter<AccessUser>();
  ngOnInit(): void {
    this.visitorService.getAllowedDays().subscribe(days => {
      this._allowedDays = days;
      this.updateDaysSelected();
    });
    this.updateDateFieldsState();
  }

  days: AccessDay[] = [
    { name: 'Lun', value: false },
    { name: 'Mar', value: false },
    { name: 'Mié', value: false },
    { name: 'Jue', value: false },
    { name: 'Vie', value: false },
    { name: 'Sáb', value: false },
    { name: 'Dom', value: false },
  ];

  form: FormGroup;

  private _allowedDays: AccessAllowedDay[] = [];

  orderDays: string[] = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  constructor(
    private visitorService: AccessVisitorsRegisterServiceService, 
    private fb: FormBuilder,
    private authService: AuthService
  ) {
    const today = new Date();
    // Ajustar al formato YYYY-MM-DD considerando la zona horaria local
    const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000))
                        .toISOString()
                        .split('T')[0];
  
    this.form = this.fb.group({
      startDateEdit: [localDate],
      endDateEdit: [localDate],
      initHourEdit: [''],
      endHourEdit: [''],
      Lun: [{ value: false, disabled: true }],
      Mar: [{ value: false, disabled: true }],
      Mié: [{ value: false, disabled: true }],
      Jue: [{ value: false, disabled: true }],
      Vie: [{ value: false, disabled: true }],
      Sáb: [{ value: false, disabled: true }],
      Dom: [{ value: false, disabled: true }],
    });
  
    this.form.get('startDateEdit')?.valueChanges.subscribe(() => this.updateAvailableDays());
    this.form.get('endDateEdit')?.valueChanges.subscribe(() => this.updateAvailableDays());
    this.form.get('initHourEdit')?.valueChanges.subscribe(() => this.validateTimeRange());
    this.form.get('endHourEdit')?.valueChanges.subscribe(() => this.validateTimeRange());

    this.userId = authService.getUser().id;
  }
  

private validateTimeRange(): void {
  const initHourEdit = this.form.get('initHourEdit')?.value;
  const endHourEdit = this.form.get('endHourEdit')?.value;

  if (initHourEdit && endHourEdit) {

    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    
    if (!timeRegex.test(initHourEdit) || !timeRegex.test(endHourEdit)) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'El formato de hora debe ser HH:mm y estar entre 00:00 y 23:59',
      });
      this.form.get('initHourEdit')?.setErrors({ invalidFormat: true });
      this.form.get('endHourEdit')?.setErrors({ invalidFormat: true });
      return;
    }

    const start = new Date(`1970-01-01T${initHourEdit}`);
    const end = new Date(`1970-01-01T${endHourEdit}`);

    // Convertir a minutos para comparar
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();

    // Validar rango de horas
    if (startMinutes < 0 || startMinutes > 1439 || endMinutes < 0 || endMinutes > 1439) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Las horas deben estar entre 00:00 y 23:59',
      });
      return;
    }

    // Validar que la hora final sea mayor que la inicial
    if (end <= start) {
      this.form.get('endHourEdit')?.setErrors({ invalidTimeRange: true });
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'La hora de fin debe ser posterior a la hora de inicio',
      });
    } else {
      this.form.get('endHourEdit')?.setErrors(null);
      this.form.get('initHourEdit')?.setErrors(null);
    }
  }
}
  updateAvailableDays(): void {
    const startDateEdit = this.form.get('startDateEdit')?.value;
    const endDateEdit = this.form.get('endDateEdit')?.value;
    
    // Deshabilitar todos los días si no hay fechas seleccionadas
    if (!startDateEdit || !endDateEdit) {
      this.orderDays.forEach(day => {
        this.form.get(day)?.disable();
      });
      return;
    }
    //SOLUCION POSIBLE:
    // Crear fechas con la hora correcta
    const start = new Date(startDateEdit + 'T00:00:00');
    const end = new Date(endDateEdit + 'T23:59:59');

    // Obtener los días disponibles
    const availableDays = this.getDaysBetweenDates(start, end);

    // Primero deshabilitar todos los días
    this.orderDays.forEach(day => {
      const control = this.form.get(day);
      control?.disable();
      control?.setValue(false);
    });
    // Luego habilitar solo los días dentro del rango
    availableDays.forEach(day => {
      const control = this.form.get(day);
      if (control) {
        control.enable();
      }
    });
    console.log('Días disponibles:', availableDays);
  }

  getDaysBetweenDates(start: Date, end: Date): string[] {

    const spanishDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];    
    const startDateEdit = new Date(start);
    const endDateEdit = new Date(end);
    

    startDateEdit.setHours(0, 0, 0, 0);
    endDateEdit.setHours(23, 59, 59, 999);
    
    const days = new Set<string>();
    const currentDate = new Date(startDateEdit);
    

    while (currentDate <= endDateEdit) {
        const dayName = spanishDays[currentDate.getDay()];
        days.add(dayName);
        
        
        const nextDate = new Date(currentDate);
        nextDate.setDate(currentDate.getDate() + 1);
        currentDate.setTime(nextDate.getTime());
    }
    
    return Array.from(days);
}
  


get areDatesDisabled(): boolean {
  return this._allowedDays.length === 0; 
}

get areDatesReadonly(): boolean {
  return this._allowedDays.length > 0; 
}
disableDateInputs: boolean = false;

  agregarAuthRange(): void {
    console.log('Iniciando agregarAuthRange');
    console.log('Valores del formulario:', this.form.value);
    
    if (!this.validateDates()) {
      return;
    }

    if (this._allowedDays.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'Por favor, agregue al menos un día permitido.',
      });
      return;
    }

    const startDateEdit = new Date(this.form.value.startDateEdit);
    const endDateEdit = new Date(this.form.value.endDateEdit);

    if (isNaN(startDateEdit.getTime()) || isNaN(endDateEdit.getTime())) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Las fechas proporcionadas no son válidas.',
      });
      return;
    }

    const authRange: AccessAuthRange = {
      initDate: startDateEdit,
      endDate: endDateEdit,
      allowedDays: this._allowedDays,
      neighbourId: this.userId,
    };

    try {
      this.visitorService.setAuthRange(authRange);
      Swal.fire({
        icon: 'success',
        title: 'Éxito',
        text: 'Rango de autorización agregado correctamente.',
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Hubo un error al guardar el rango de autorización.',
      });
    }
  }

  updateDaysSelected(): void {
    this.days.forEach(day => {
      day.value = this._allowedDays.some(dayAllowed => dayAllowed.day.name === day.name);
      this.form.controls[day.name].setValue(day.value);
    });
  }

  get allowedDays(): AccessAllowedDay[] {
    return [...this._allowedDays].sort((a, b) => {
      const indexA = this.orderDays.indexOf(a.day.name);
      const indexB = this.orderDays.indexOf(b.day.name);
      return indexA - indexB;
    });
  }

  validateHours(): boolean {
    if (!this.form.value.initHourEdit || !this.form.value.endHourEdit) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor, ingrese tanto la hora de inicio como la hora de fin.',
      });
      return false;
    }
    return true;
  }
  private updateDateFieldsState(): void {
    if (this._allowedDays.length > 0) {
      this.form.controls['startDateEdit'].disable();
      this.form.controls['endDateEdit'].disable();
    } else {
      this.form.controls['startDateEdit'].enable();
      this.form.controls['endDateEdit'].enable();
    }
  }
  agregarDiasPermitidos(): void {
   
    if (!this.validateHours()) return;
    if (!this.validateDates()) return;
  
    const initHourEdit = new Date(`1970-01-01T${this.form.value.initHourEdit}:00`);
    const endHourEdit = new Date(`1970-01-01T${this.form.value.endHourEdit}:00`);
  
    const crossesMidnight = endHourEdit <= initHourEdit;
  
    const newDaysAlloweds: AccessAllowedDay[] = this.days
      .filter(day => this.form.controls[day.name].value && !this._allowedDays.some(dp => dp.day.name === day.name))
      .map(day => ({
        day: { ...day },
        startTime: initHourEdit,
        endTime: endHourEdit,
        crossesMidnight: crossesMidnight,
      }));
  
    if (newDaysAlloweds.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'Por favor, seleccione al menos un día nuevo para agregar.',
      });
      return;
    }
    
    this._allowedDays = [...this._allowedDays, ...newDaysAlloweds];
    this.visitorService.updateAllowedDays(this._allowedDays);
    
    // Resetear los valores
    this.form.get('initHourEdit')?.reset();
    this.form.get('endHourEdit')?.reset();
    
    // Marcar como no tocados y actualizar validación
    this.form.get('initHourEdit')?.markAsUntouched();
    this.form.get('endHourEdit')?.markAsUntouched();
    this.form.get('initHourEdit')?.updateValueAndValidity();
    this.form.get('endHourEdit')?.updateValueAndValidity();
    
    this.updateDaysSelected();
    this.agregarAuthRange();
  }
  isAllowedDay(day: AccessDay): boolean {
  
    return this._allowedDays.some(allowedDay => allowedDay.day.name === day.name);
  }

  deleteAllowedDay(allowedDay: AccessAllowedDay): void {
    const index = this._allowedDays.findIndex(dp => dp.day.name === allowedDay.day.name);
    if (index !== -1) {
        this._allowedDays.splice(index, 1);
    }
    this.visitorService.updateAllowedDays(this._allowedDays);
    this.updateDaysSelected();
}

  formatHour(schedule: AccessAllowedDay): string {
    const formatHour = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const init = formatHour(schedule.startTime);
    const end = formatHour(schedule.endTime);
    return schedule.crossesMidnight ? `${init} - ${end}` : `${init} - ${end}`;
  }
  validateDates(): boolean {
    console.log('Validando fechas');
    console.log('Valor de startDateEdit:', this.form.value.startDateEdit);
    console.log('Valor de endDateEdit:', this.form.value.endDateEdit);
  

    if (!this.form.value.startDateEdit || !this.form.value.endDateEdit) {
      console.log('Fechas no proporcionadas');
      Swal.fire({
        icon: 'error',
        title: 'Fecha inválida',
        text: 'Por favor, ingrese ambas fechas.',
      });
      return false;
    }
  

    const startDateEdit = new Date(this.form.value.startDateEdit + 'T00:00:00');
    const endDateEdit = new Date(this.form.value.endDateEdit + 'T00:00:00');
  
    console.log('Fechas parseadas:', {
      startDateEdit,
      endDateEdit,
      isStartDateEditValid: !isNaN(startDateEdit.getTime()),
      isEndDateEditValid: !isNaN(endDateEdit.getTime())
    });
  
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
  

    if (startDateEdit < currentDate) {
      console.log('Fecha de inicio anterior a la fecha actual');
      Swal.fire({
        icon: 'error',
        title: 'Fecha inválida',
        text: 'La fecha de inicio no puede ser anterior a la fecha actual.',
      });
      return false;
    }
  
    if (endDateEdit < currentDate) {
      console.log('Fecha de fin anterior a la fecha actual');
      Swal.fire({
        icon: 'error',
        title: 'Fecha inválida',
        text: 'La fecha de fin no puede ser anterior a la fecha actual.',
      });
      return false;
    }
  
    if (endDateEdit < startDateEdit) {
      console.log('Fecha de fin anterior a fecha de inicio');
      Swal.fire({
        icon: 'error',
        title: 'Fecha inválida',
        text: 'La fecha de fin no puede ser anterior a la fecha de inicio.',
      });
      return false;
    }
  
    console.log('Validación de fechas exitosa');
    return true;
  }

}
