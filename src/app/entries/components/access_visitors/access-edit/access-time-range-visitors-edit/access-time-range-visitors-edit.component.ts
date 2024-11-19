import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { AccessAllowedDay, AccessDay, AccessAuthRange,AccessUser } from '../../../../models/access-visitors/access-visitors-models';
import { AccessVisitorsRegisterServiceService } from '../../../../services/access_visitors/access-visitors-register/access-visitors-register-service/access-visitors-register-service.service';
import Swal from 'sweetalert2';
import { Subject } from 'rxjs';
import { AccessVisitorsRegisterServiceHttpClientService } from '../../../../services/access_visitors/access-visitors-register/access-visitors-register-service-http-client/access-visitors-register-service-http-client.service';
import { takeUntil } from 'rxjs';
import { AccessVisitorsEditServiceService } from '../../../../services/access_visitors/access-visitors-edit/access-visitors-edit-service/access-visitors-edit-service.service';
import { AccessVisitorsEditServiceHttpClientService } from '../../../../services/access_visitors/access-visitors-edit/access-visitors-edit-service-http-service/access-visitors-edit-service-http-client.service';
import { AccessApiAllowedDay, AccessAuthRangeInfoDto2 } from '../../../../models/access-visitors/access-VisitorsModels';
import { VisitorsService } from '../../../../services/access_visitors/access-visitors.service';

@Component({
  selector: 'app-access-time-range-visitors-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './access-time-range-visitors-edit.component.html',
  styleUrl: './access-time-range-visitors-edit.component.css'
})
export class AccessTimeRangeVisitorsEditComponent implements OnInit {
  private unsubscribe$ = new Subject<void>();
  
  private _isFromParent: boolean = true;
  neighborid: number = 0;

  days: AccessDay[] = [
    { name: 'Lun', value: false },
    { name: 'Mar', value: false },
    { name: 'Mié', value: false },
    { name: 'Jue', value: false },
    { name: 'Vie', value: false },
    { name: 'Sáb', value: false },
    { name: 'Dom', value: false },
  ];
  private readonly dayOrder: { [key: string]: number } = {
    'MONDAY': 0,
    'TUESDAY': 1,
    'WEDNESDAY': 2,
    'THURSDAY': 3,
    'FRIDAY': 4,
    'SATURDAY': 5,
    'SUNDAY': 6
  };
  form: FormGroup;

  private _allowedDays: AccessApiAllowedDay[] = [];

  orderDays: string[] = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  
  constructor(private cdr: ChangeDetectorRef,    private visitorService: AccessVisitorsEditServiceService, private fb: FormBuilder,private httpService:AccessVisitorsEditServiceHttpClientService) {
      this.form = this.fb.group({
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      initHour: ['', Validators.required],
      endHour: ['', Validators.required],
      Lun: [{ value: false, disabled: true }],
      Mar: [{ value: false, disabled: true }],
      Mié: [{ value: false, disabled: true }],
      Jue: [{ value: false, disabled: true }],
      Vie: [{ value: false, disabled: true }],
      Sáb: [{ value: false, disabled: true }],
      Dom: [{ value: false, disabled: true }],
    });


    this.form.get('startDate')?.valueChanges.subscribe(() => this.updateAvailableDays());
    this.form.get('endDate')?.valueChanges.subscribe(() => this.updateAvailableDays());
  }
  
  updateAvailableDays(): void {
    const startDate = this.form.get('startDate')?.value;
    const endDate = this.form.get('endDate')?.value;
 
    if (!startDate || !endDate) {
      this.orderDays.forEach(day => {
        this.form.get(day)?.disable();
      });
      return;
    }

    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');
    const availableDays = this.getDaysBetweenDates(start, end);

    // Deshabilitar todos los días primero
    this.orderDays.forEach(day => {
      const control = this.form.get(day);
      control?.disable();
      control?.setValue(false);
    });

    // Habilitar solo los días disponibles que no están ya agregados
    availableDays.forEach(day => {
      const control = this.form.get(day);
      const isAlreadyAdded = this._allowedDays.some(
        allowedDay => this.getDayNameInSpanish(allowedDay.day) === day
      );
      
      if (control && !isAlreadyAdded) {
        control.enable();
      } else if (control) {
        control.disable();
      }
    });
  }

  
  getDaysBetweenDates(start: Date, end: Date): string[] {

    const spanishDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];    
    const startDate = new Date(start);
    const endDate = new Date(end);
    

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    const days = new Set<string>();
    const currentDate = new Date(startDate);
    

    while (currentDate <= endDate) {
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
  const hasValues = this.form.get('startDate')?.value && 
                   this.form.get('endDate')?.value;
  return this._allowedDays.length > 0 && 
         this._isFromParent && 
         hasValues;
}
 
disableDateInputs: boolean = false;


ngOnInit(): void {
  this.visitorService.getAllowedDays().subscribe(days => {
    this._allowedDays = days;
    this.updateDaysSelected();
    if (!this.form.get('startDate')?.value || !this.form.get('endDate')?.value) {
      this.orderDays.forEach(day => {
        const control = this.form.get(day);
        if (control) {
          control.disable();
        }
      });
    } else {
      this.updateAvailableDays();
    }
  });
  this.updateDateFieldsState();
}

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

    const startDate = new Date(this.form.value.startDate);
    const endDate = new Date(this.form.value.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Las fechas proporcionadas no son válidas.',
      });
      return;
    }
    this.visitorService.getNeighbors().subscribe(id => {
      this.neighborid = id;
  
    });
    console.log('Valores del vecino:', this.neighborid);
    const authRange: AccessAuthRangeInfoDto2 = {
      
      neighbor_id :this.neighborid,
      init_date: startDate,
      end_date: endDate,
      allowedDays: this._allowedDays,
      
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
      const control = this.form.get(day.name);
      if (control) {
        const isAllowed = this.allowedDays.some(dayAllowed => dayAllowed.day === day.name);
        if (isAllowed) {
          control.setValue(true);
          control.disable();
        } else if (!control.disabled) {
          control.setValue(false);
        }
      }
    });
  }

  
  get allowedDays(): AccessApiAllowedDay[] {
    return [...this._allowedDays].sort((a, b) => {
      return this.dayOrder[a.day] - this.dayOrder[b.day];
    });
  }

  validateHours(): boolean {
    if (!this.form.value.initHour || !this.form.value.endHour) {
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
      this.form.controls['startDate'].disable();
      this.form.controls['endDate'].disable();
    } else {
      this.form.controls['startDate'].enable();
      this.form.controls['endDate'].enable();
    }
  }
  agregarDiasPermitidos(): void {
    if (!this.validateHours()) return;
    if (!this.validateDates()) return;
    
    const [initHour, initMinute] = this.form.value.initHour.split(':').map(Number);
    const [endHour, endMinute] = this.form.value.endHour.split(':').map(Number);
  
    const selectedDays = this.days.filter(day => this.form.controls[day.name].value);
    const newDaysToAdd: AccessApiAllowedDay[] = selectedDays.map(day => ({
      day: this.getDayName(day.name),
      init_hour: [initHour, initMinute],
      end_hour: [endHour, endMinute]
    }));

    const conflictingDays: string[] = [];
    
    newDaysToAdd.forEach(newDay => {
      const existingDay = this._allowedDays.find(existing => existing.day === newDay.day);
      
      if (existingDay) {
        const newStartTime = newDay.init_hour[0] * 60 + newDay.init_hour[1];
        const newEndTime = newDay.end_hour[0] * 60 + newDay.end_hour[1];
        const existingStartTime = existingDay.init_hour[0] * 60 + existingDay.init_hour[1];
        const existingEndTime = existingDay.end_hour[0] * 60 + existingDay.end_hour[1];

        if ((newStartTime >= existingStartTime && newStartTime < existingEndTime) ||
            (newEndTime > existingStartTime && newEndTime <= existingEndTime) ||
            (newStartTime <= existingStartTime && newEndTime >= existingEndTime)) {
          
          const spanishDay = this.getDayNameInSpanish(newDay.day);
          const existingTimeRange = this.formatHour(existingDay);
          conflictingDays.push(`${spanishDay} (ya existe en horario: ${existingTimeRange})`);
        }
      }
    });
 
    if (conflictingDays.length > 0) {
      Swal.fire({
        icon: 'error',
        title: 'Conflicto de horarios',
        text: `Los siguientes días tienen conflictos: ${conflictingDays.join(', ')}`
      });
      return;
    }
  
    // Actualizar los días permitidos y deshabilitar los controles correspondientes
    const updatedDays = [...this._allowedDays, ...newDaysToAdd].sort(
      (a, b) => this.dayOrder[a.day] - this.dayOrder[b.day]
    );
    
    this.visitorService.updateAllowedDays(updatedDays);
    
    // Deshabilitar los días que se acaban de agregar
    selectedDays.forEach(day => {
      const control = this.form.get(day.name);
      if (control) {
        control.disable();
        control.setValue(false);
      }
    });

    // Resetear los campos de hora
    this.form.get('initHour')?.reset();
    this.form.get('endHour')?.reset();
    
    // Actualizar la vista
    this.updateAvailableDays();
    this.cdr.detectChanges();
    this.agregarAuthRange();
  }

  private resetDaySelections(): void {
    this.days.forEach(day => {
      const control = this.form.get(day.name);
      if (control && !control.disabled) {
        control.setValue(false);
      }
    });
  }
  isAllowedDay(day: AccessDay): boolean {
    return this._allowedDays.some(allowedDay => allowedDay.day === day.name);
  }

  deleteAllowedDay(allowedDay: AccessApiAllowedDay): void {
    // Eliminar el día de los días permitidos
    const updatedDays = this._allowedDays.filter(dp => dp.day !== allowedDay.day);
    this.visitorService.updateAllowedDays(updatedDays);
    
    // Obtener el nombre del día en español
    const spanishDayName = this.getDayNameInSpanish(allowedDay.day);
    
    // Verificar si el día está dentro del rango de fechas seleccionado
    const startDate = this.form.get('startDate')?.value;
    const endDate = this.form.get('endDate')?.value;
    
    if (startDate && endDate) {
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59');
        const availableDays = this.getDaysBetweenDates(start, end);
        
        if (availableDays.includes(spanishDayName)) {
            const control = this.form.get(spanishDayName);
            if (control) {
                control.enable();
                control.setValue(false);
            }
        }
    }

    // Agregar esta línea para actualizar el AuthRange
    this.agregarAuthRange();
    
    this.cdr.detectChanges();
}

  formatHour(schedule: AccessApiAllowedDay): string {
    const padNumber = (num: number) => num.toString().padStart(2, '0');
    const initFormatted = `${padNumber(schedule.init_hour[0])}:${padNumber(schedule.init_hour[1])}`;
    const endFormatted = `${padNumber(schedule.end_hour[0])}:${padNumber(schedule.end_hour[1])}`;
    return `${initFormatted} - ${endFormatted}`;
  }
  validateDates(): boolean {
    console.log('Validando fechas');
    console.log('Valor de startDate:', this.form.value.startDate);
    console.log('Valor de endDate:', this.form.value.endDate);
  

    if (!this.form.value.startDate || !this.form.value.endDate) {
      console.log('Fechas no proporcionadas');
      Swal.fire({
        icon: 'error',
        title: 'Fecha inválida',
        text: 'Por favor, ingrese ambas fechas.',
      });
      return false;
    }
  

    const startDate = new Date(this.form.value.startDate + 'T00:00:00');
    const endDate = new Date(this.form.value.endDate + 'T00:00:00');
  
    console.log('Fechas parseadas:', {
      startDate,
      endDate,
      isStartDateValid: !isNaN(startDate.getTime()),
      isEndDateValid: !isNaN(endDate.getTime())
    });
  
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
  

    if (startDate < currentDate && !this._isFromParent) {
  console.log('Fecha de inicio anterior a la fecha actual');
  Swal.fire({
    icon: 'error',
    title: 'Fecha inválida',
    text: 'La fecha de inicio no puede ser anterior a la fecha actual.',
  });
  return false;
}
  
    if (endDate < currentDate) {
      console.log('Fecha de fin anterior a la fecha actual');
      Swal.fire({
        icon: 'error',
        title: 'Fecha inválida',
        text: 'La fecha de fin no puede ser anterior a la fecha actual.',
      });
      return false;
    }
  
    if (endDate < startDate) {
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
  getDayNameInSpanish(englishDay: string): string {
    const dayMap: { [key: string]: string } = {
      'MONDAY': 'Lun',
      'TUESDAY': 'Mar',
      'WEDNESDAY': 'Mié',
      'THURSDAY': 'Jue',
      'FRIDAY': 'Vie',
      'SATURDAY': 'Sáb',
      'SUNDAY': 'Dom'
    };
    return dayMap[englishDay] || englishDay;
  }
  getDayName(englishDay: string): string {
    const dayMap: { [key: string]: string } = {
      'Lun': 'MONDAY',
      'Mar': 'TUESDAY',
      'Mié': 'WEDNESDAY',
      'Jue': 'THURSDAY',
      'Vie': 'FRIDAY',
      'Sáb': 'SATURDAY',
      'Dom': 'SUNDAY'
    };
    return dayMap[englishDay] || englishDay;
  }

  
}
