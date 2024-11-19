import {
  Component,
  EventEmitter,
  OnInit,
  AfterViewInit,
  ViewEncapsulation,
  inject,
  ViewChild,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { CommonModule } from '@angular/common';
import $ from 'jquery';
import 'datatables.net';
import 'datatables.net-bs5';
import Swal from 'sweetalert2';
import { Subject, takeUntil } from 'rxjs';
import { UserType } from '../../../../models/access-visitors/access-visitors-models';
import {
  AccessUserAllowedInfoDto2,
  AccessDayOfWeek,
  AccessFormattedHours,
} from '../../../../models/access-visitors/access-VisitorsModels';
import { AccessVisitorsRegisterServiceHttpClientService } from '../../../../services/access_visitors/access-visitors-register/access-visitors-register-service-http-client/access-visitors-register-service-http-client.service';
import { AccessVisitorsEditServiceService } from '../../../../services/access_visitors/access-visitors-edit/access-visitors-edit-service/access-visitors-edit-service.service';
import { AccessTimeRangeVisitorsEditComponent } from '../access-time-range-visitors-edit/access-time-range-visitors-edit.component';
import { UserService } from '../../../../../users/users-servicies/user.service';
import { AuthService } from '../../../../../users/users-servicies/auth.service';

interface ValidationErrors {
  [key: string]: string | TimeRangeErrors;
}

interface TimeRangeErrors {
  [key: string]: string;
}

interface AdditionalVisitorsErrors {
  [key: number]: {
    [key: string]: string;
  };
}

@Component({
  selector: 'access-app-edit',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    ReactiveFormsModule,
    AccessTimeRangeVisitorsEditComponent,
  ],
  templateUrl: './access-edit.component.html',
  styleUrl: './access-edit.component.css',
  providers: [DatePipe],
})
export class AccessEditComponent implements OnInit, AfterViewInit {
  public validationErrors: ValidationErrors = {};
  private additionalVisitorsErrors: AdditionalVisitorsErrors = {};
  private http = inject(HttpClient);
  visitors: AccessUserAllowedInfoDto2[] = [];
  @ViewChild(AccessTimeRangeVisitorsEditComponent)
  timeRangeComponent?: AccessTimeRangeVisitorsEditComponent;
  indexUserType = 0;
  neighbor_id: Number | null = null;
  table: any = null;
  private unsubscribe$ = new Subject<void>();
  todayDate: string = '';
  editForm!: FormGroup;
  searchTerm: string = '';
  usersType: UserType[] = [];
  isModalVisible: boolean = false; // New property to control modal visibility
  user: any = null;
  constructor(
    private datePipe: DatePipe,
    private fb: FormBuilder,
    private visitorHttpService: AccessVisitorsRegisterServiceHttpClientService,
    private visitorService: AccessVisitorsEditServiceService,
    private userService: AuthService
  ) {}
  // Selected visitor for editing
  selectedVisitor: AccessUserAllowedInfoDto2 = {
    document: '',
    documentType: 0,
    userType: 0,
    name: '',
    last_name: '',
    email: '',
    authId: '',
    authRange: {
      init_date: new Date(),
      end_date: new Date(),
      allowedDays: [
        {
          day: '',
          init_hour: [0, 0],
          end_hour: [0, 0],
        },
      ],
      neighbor_id: 0,
    },
    vehicle: {
      id: 0,
      plate: '',
      vehicle_Type: {
        description: '',
      },
      insurance: '',
    },
    visitorId: 0,
  };


  newVisitorTemplate: Partial<AccessUserAllowedInfoDto2> = {
    document: '',
    name: '',
    last_name: '',
    email: '',
  };
  ngAfterViewInit(): void {
    // this.editModal = new Modal(document.getElementById('editVisitorModal')!);

    $('#tablaEdit tbody').on('click', '.view-more-btn', (event: any) => {
      const index = $(event.currentTarget).data('index');
      const visitor = this.visitors[index];

      this.editVisitor(visitor);
    });
  }

  ngOnInit(): void {
    this.setTodayDate();
    this.fetchUser();
    this.loadUsersType();
    this.initForm();
  }
  initForm(): void {
    this.editForm = this.fb.group({
      authorizedType: [1, Validators.required],
      name: ['', [Validators.required, Validators.maxLength(45)]],
      last_name: ['', [Validators.required, Validators.maxLength(45)]],
      document: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(15),
          Validators.pattern(/^[a-zA-Z0-9]*$/),
        ],
      ],
      email: ['', [Validators.required, Validators.email]],
      init_date: [''],
      end_date: ['', [Validators.required]],
      allowedDays: this.fb.array([]),
    });
  }

  setTodayDate(): void {
    const currentDate = new Date();
    this.todayDate = this.datePipe.transform(currentDate, 'yyyy-MM-dd') || ''; // Formato compatible con el input de tipo date
  }
  loadUsersType(): void {
    this.visitorHttpService
      .getUsersType()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (types: UserType[]) => {
          this.usersType = types;
          console.log('Tipos de usuario cargados:', this.usersType);
        },
        error: (error) => {
          console.error('Error al cargar tipos de usuarios:', error);
        },
      });
  }

  loadDataIntoTable(): void {
    if ($.fn.dataTable.isDataTable('#tablaEdit')) {
      $('#tablaEdit').DataTable().clear().destroy();
    }

    this.table = $('#tablaEdit').DataTable({
      // Configuración básica de la tabla
      paging: true,
      searching: true,
      ordering: true,
      lengthChange: true,
      order: [0, 'asc'],
      lengthMenu: [10, 25, 50],
      pageLength: 10,
      data: this.visitors, // Fuente de datos

      // Definición de columnas
      columns: [
        {
          data: null,
          className: 'align-middle',
          render: (data) => `<div>${data.name} ${data.last_name}</div>`,
        },
        {
          data: 'document',
          className: 'align-middle',
          render: (data) => `<div>${data || ''}</div>`,
        },
        {
          data: 'email',
          className: 'align-middle',
          render: (data) => `<div>${data || ''}</div>`,
        },
        {
          data: 'authRange',
          className: 'align-middle',
          render: (data) => {
            const initDate = data
              ? this.datePipe.transform(data.init_date, 'dd/MM/yyyy')
              : '';
            return `<div>${initDate}</div>`;
          },
        },
        {
          data: 'authRange',
          className: 'align-middle',
          render: (data) => {
            const endDate = data
              ? this.datePipe.transform(data.end_date, 'dd/MM/yyyy')
              : '';
            return `<div>${endDate}</div>`;
          },
        },
        {
          data: null,
          className: 'align-middle text-center',
          searchable: false,
          render: (data, type, row, meta) => `
            <button class="btn btn-info btn-sm view-more-btn" data-index="${meta.row}">Editar</button>`,
        },
      ],

      // Personalización del DOM y mensajes
      dom: '<"mb-3"t><"d-flex justify-content-between"lp>',
      language: {
        lengthMenu: `
          <select class="form-select">
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>`,
        zeroRecords: 'No se encontraron visitantes',
        loadingRecords: 'Cargando...',
        processing: 'Procesando...',
      },
    });
    this.table.draw();
  }
  onSubmit(): void {
    if (this.editForm.invalid) {
      Object.keys(this.editForm.controls).forEach((key) => {
        const control = this.editForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
      return;
    }

    // Update selectedVisitor with form values
    const formValues = this.editForm.getRawValue();
    this.selectedVisitor = {
      ...this.selectedVisitor,
      name: formValues.name,
      last_name: formValues.last_name,
      document: formValues.document,
      email: formValues.email,
      authRange: {
        ...this.selectedVisitor.authRange,
        end_date: new Date(formValues.end_date),
      },
    };

    this.saveAllVisitors();
  }

  fetchvisitors(): void {
    const neighbor = this.user.id;
    this.visitorHttpService.fetchVisitorsByNeighbor(neighbor).subscribe({
      next: (response) => {
        this.visitors = response;
        if (this.visitors.length === 0) {
          Swal.fire({
            icon: 'warning',
            title: 'Error al obtener los ingresos',
            text: 'No hay visitantes disponibles',
          });
        }
        setTimeout(() => {
          this.loadDataIntoTable();
        }, 0);
      },
    });
  }

  fetchUser(): void {
    const user = this.userService.getUser();
    this.user = user;
    this.fetchvisitors();
  }
  //validaciones
  validateField(fieldName: string, value: string, visitorIndex?: number): void {
    const errors = this.getFieldError(fieldName, value);

    if (visitorIndex !== undefined) {
      if (!this.additionalVisitorsErrors[visitorIndex]) {
        this.additionalVisitorsErrors[visitorIndex] = {};
      }
      if (errors) {
        this.additionalVisitorsErrors[visitorIndex][fieldName] = errors;
      } else {
        delete this.additionalVisitorsErrors[visitorIndex][fieldName];
      }
    } else {
      if (errors) {
        this.validationErrors[fieldName] = errors;
      } else {
        delete this.validationErrors[fieldName];
      }
    }
  }
  private getFieldError(fieldName: string, value: string): string | null {
    switch (fieldName) {
      case 'name':
        return !value?.trim() ? 'El nombre es requerido' : null;
      case 'last_name':
        return !value?.trim() ? 'El apellido es requerido' : null;
      case 'document':
        return !value?.trim() ? 'El documento es requerido' : null;
      case 'email':
        // Si el tipo de usuario es 1, el email es requerido
        if (this.indexUserType === 1) {
          if (!value?.trim()) return 'El email es requerido';
          return !this.isValidEmail(value)
            ? 'El formato del email no es válido'
            : null;
        } else {
          // Si el tipo de usuario no es 1, solo validamos el formato si se proporciona un email
          return value?.trim() && !this.isValidEmail(value)
            ? 'El formato del email no es válido'
            : null;
        }
      default:
        return null;
    }
  }

  validateDateRange(): void {
    const initDate = new Date(this.selectedVisitor.authRange.init_date);
    const endDate = new Date(this.selectedVisitor.authRange.end_date);

    if (endDate <= initDate) {
      this.validationErrors['end_date'] =
        'La fecha de fin debe ser mayor a la fecha de inicio';
    } else {
      delete this.validationErrors['end_date'];
    }

    // Validar que al menos un día esté seleccionado
    if (this.selectedVisitor.authRange.allowedDays.length === 0) {
      this.validationErrors['allowed_days'] =
        'Debe seleccionar al menos un día de la semana';
    } else {
      delete this.validationErrors['allowed_days'];
    }

    // Validar las horas de cada día seleccionado
    this.selectedVisitor.authRange.allowedDays.forEach((day) => {
      const initHour = day.init_hour[0] * 60 + day.init_hour[1];
      const endHour = day.end_hour[0] * 60 + day.end_hour[1];

      if (endHour <= initHour) {
        if (!this.validationErrors['time_range']) {
          this.validationErrors['time_range'] = {} as TimeRangeErrors;
        }
        (this.validationErrors['time_range'] as TimeRangeErrors)[day.day] =
          'La hora final debe ser mayor a la hora inicial';
      } else {
        if (this.validationErrors['time_range']) {
          delete (this.validationErrors['time_range'] as TimeRangeErrors)[
            day.day
          ];
          if (
            Object.keys(this.validationErrors['time_range'] as TimeRangeErrors)
              .length === 0
          ) {
            delete this.validationErrors['time_range'];
          }
        }
      }
    });
  }

  hasValidationErrors(): boolean {
    this.validationErrors = {};

    const formControls = this.editForm.controls;
    let hasErrors = false;

    Object.keys(formControls).forEach((key) => {
      const control = formControls[key];

      if (key === 'email' && this.indexUserType !== 1 && !control.value) {
        return;
      }

      if (control.errors && control.touched) {
        this.validationErrors[key] = control.errors;
        hasErrors = true;
      }
    });

    if (this.timeRangeComponent) {
      const timeRangeForm = this.timeRangeComponent.form;
      if (timeRangeForm.invalid && timeRangeForm.touched) {
        hasErrors = true;
      }
    }

    const initDate = new Date(this.selectedVisitor.authRange.init_date);
    const endDate = new Date(this.selectedVisitor.authRange.end_date);

    if (endDate <= initDate) {
      this.validationErrors['end_date'] =
        'La fecha de fin debe ser mayor a la fecha de inicio';
      hasErrors = true;
    }

    const hasAdditionalErrors = Object.keys(this.additionalVisitorsErrors).some(
      (index) =>
        Object.keys(this.additionalVisitorsErrors[Number(index)]).length > 0
    );

    console.log('Validation Errors:', this.validationErrors);
    console.log('Has Form Errors:', hasErrors);
    console.log('Has Additional Errors:', hasAdditionalErrors);

    return hasErrors || hasAdditionalErrors;
  }

  getValidationClass(fieldName: string, visitorIndex?: number): string {
    if (visitorIndex !== undefined) {
      return this.additionalVisitorsErrors[visitorIndex]?.[fieldName]
        ? 'is-invalid'
        : '';
    }
    return this.validationErrors[fieldName] ? 'is-invalid' : '';
  }

  // Método helper para obtener el mensaje de error
  getErrorMessage(controlName: string): string {
    const control = this.editForm.get(controlName);
    if (control?.errors && control.touched) {
      if (control.errors['required']) return 'Este campo es requerido';
      if (control.errors['email']) return 'Ingrese un email válido';
      if (control.errors['minlength'])
        return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
      if (control.errors['maxlength'])
        return `Máximo ${control.errors['maxlength'].requiredLength} caracteres`;
      if (control.errors['pattern']) return 'Solo se permiten letras y números';
    }
    return '';
  }
  // Helper method to validate email format
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  getTimeErrorMessage(day: AccessDayOfWeek): string {
    return ((this.validationErrors['time_range'] as TimeRangeErrors)?.[day] ||
      '') as string;
  }
  hasTimeError(day: AccessDayOfWeek): boolean {
    return !!(this.validationErrors['time_range'] as TimeRangeErrors)?.[day];
  }

  formatDateForInput(date: Date | string | undefined): string {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return this.datePipe.transform(dateObj, 'yyyy-MM-dd') || '';
  }
  readonly DAYS_OF_WEEK: AccessDayOfWeek[] = [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY',
  ];

  // auxiliares del modal
  getDayTranslation(day: AccessDayOfWeek): string {
    const translations: Record<AccessDayOfWeek, string> = {
      MONDAY: 'Lunes',
      TUESDAY: 'Martes',
      WEDNESDAY: 'Miércoles',
      THURSDAY: 'Jueves',
      FRIDAY: 'Viernes',
      SATURDAY: 'Sábado',
      SUNDAY: 'Domingo',
    };
    return translations[day];
  }
  private formatTimeArrayToString(timeArray: number[]): string {
    if (!timeArray || timeArray.length !== 2) {
      return '';
    }

    const hours = timeArray[0].toString().padStart(2, '0');
    const minutes = timeArray[1].toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  saveAllVisitors(): void {
    if (this.hasValidationErrors()) {
      Swal.fire({
        icon: 'error',
        title: 'Error de validación',
        text: 'Por favor corrija los campos marcados en rojo',
      });
      return;
    }
  
    Swal.fire({
      title: '¿Estás seguro?',
      text: '¿Deseas actualizar estos visitantes?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, actualizar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        const allVisitors = [this.selectedVisitor];
        let updatedVisitor= this.selectedVisitor;
        // Get auth range and allowed days
        this.visitorService.getAuthRange().subscribe((authRangeInfo) => {
          if (authRangeInfo) {
            this.visitorService.getAllowedDays().subscribe((allowedDays) => {
              authRangeInfo.allowedDays = allowedDays;
              
              // Update visitor data
               updatedVisitor={
                document: this.selectedVisitor.document,
                documentType: this.selectedVisitor.documentType,
                userType: this.editForm.get('authorizedType')?.value,
                name: this.selectedVisitor.name,
                last_name: this.selectedVisitor.last_name,
                email: this.selectedVisitor.email,
                authId: this.selectedVisitor.authId,
                authRange: authRangeInfo,
                vehicle: this.selectedVisitor.vehicle,
                visitorId: this.selectedVisitor.visitorId,
              };
  
              // Use the service to update the visitor
              
            });
          }
        });
        this.visitorHttpService.updateVisitor(updatedVisitor).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Éxito',
              text: 'El visitante ha sido actualizado correctamente',
            });
            this.hideModal();
            this.fetchvisitors();
          },
          error: (error) => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Hubo un error al actualizar el visitante',
            });
          }
        });
      }
    });
  }

  editVisitor(visitor: AccessUserAllowedInfoDto2): void {
    this.selectedVisitor = JSON.parse(JSON.stringify(visitor));
    console.log('Selected Visitor:', this.selectedVisitor);
    console.log('Visitor UserType:', visitor.userType);
    console.log('Available Types:', this.usersType);
    this.indexUserType = this.selectedVisitor.userType;
    this.updateemailcontrol();
    // Update form with visitor data
    this.editForm.patchValue({
      authorizedType: visitor.userType,
      name: visitor.name,
      last_name: visitor.last_name,
      document: visitor.document,
      email: visitor.email,
      init_date: this.formatDateForInput(visitor.authRange.init_date),
      end_date: this.formatDateForInput(visitor.authRange.end_date),
    });
    if (this.timeRangeComponent && this.selectedVisitor.authRange) {
      const initDate = new Date(this.selectedVisitor.authRange.init_date);
      const endDate = new Date(this.selectedVisitor.authRange.end_date);

      const formattedInitDate = initDate.toISOString().split('T')[0];
      const formattedEndDate = endDate.toISOString().split('T')[0];

      this.timeRangeComponent.form.get('startDate')?.enable();
      this.timeRangeComponent.form.get('endDate')?.enable();

      this.timeRangeComponent.form.patchValue({
        startDate: formattedInitDate,
        endDate: formattedEndDate,
      });

      if (this.selectedVisitor.authRange.allowedDays) {
        this.visitorService.clearAllowedDays();
        this.visitorService.addAllowedDays(
          this.selectedVisitor.authRange.allowedDays
        );
      }
    }
    // Make document field readonly
    this.editForm.get('document')?.disable();

    this.showModal();
  }

  isDayAllowed(day: AccessDayOfWeek): boolean {
    return this.selectedVisitor.authRange.allowedDays.some(
      (allowedDay) => allowedDay.day === day.toUpperCase()
    );
  }
  getAllowedDayHours(day: AccessDayOfWeek): AccessFormattedHours {
    const allowedDay = this.selectedVisitor.authRange.allowedDays.find(
      (d) => d.day === day.toUpperCase()
    );

    if (!allowedDay) {
      return { init_hour: '', end_hour: '' };
    }

    return {
      init_hour: this.formatTimeArrayToString(allowedDay.init_hour),
      end_hour: this.formatTimeArrayToString(allowedDay.end_hour),
    };
  }

  // Update all visitors when changing dates or allowed days
  updateAllVisitorsAuthRanges(): void {
    const authRangesCopy = JSON.parse(
      JSON.stringify(this.selectedVisitor.authRange)
    );
  }

  onInitDateChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target && target.value) {
      this.selectedVisitor.authRange.init_date = new Date(target.value);
      this.updateAllVisitorsAuthRanges();
    }
  }

  onEndDateChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target && target.value) {
      this.selectedVisitor.authRange.end_date = new Date(
        target.value + 'T00:00:00'
      );
      this.updateAllVisitorsAuthRanges();
    }
  }

  toggleDay(day: AccessDayOfWeek): void {
    const allowedDays = this.selectedVisitor.authRange.allowedDays;
    const index = allowedDays.findIndex((d) => d.day === day.toUpperCase());

    if (index === -1) {
      allowedDays.push({
        day: day.toUpperCase(),
        init_hour: [9, 0],
        end_hour: [17, 0],
      });
    } else {
      allowedDays.splice(index, 1);
    }

    this.updateAllVisitorsAuthRanges();
  }

  updateInitHour(day: AccessDayOfWeek, event: any): void {
    const allowedDay = this.selectedVisitor.authRange.allowedDays.find(
      (d) => d.day === day.toUpperCase()
    );
    if (allowedDay) {
      const [hours, minutes] = event.target.value.split(':');
      allowedDay.init_hour = [parseInt(hours, 10), parseInt(minutes, 10)];
      this.validateDateRange(); // Validar después de actualizar la hora
      this.updateAllVisitorsAuthRanges();
    }
  }
  updateEndHour(day: AccessDayOfWeek, event: any): void {
    const allowedDay = this.selectedVisitor.authRange.allowedDays.find(
      (d) => d.day === day.toUpperCase()
    );
    if (allowedDay) {
      const [hours, minutes] = event.target.value.split(':');
      allowedDay.end_hour = [parseInt(hours, 10), parseInt(minutes, 10)];
      this.validateDateRange(); // Validar después de actualizar la hora
      this.updateAllVisitorsAuthRanges();
    }
  }
  //parte del modal
  showModal(): void {
    this.isModalVisible = true;
    document.body.classList.add('modal-open');
  }
  hideModal(): void {
    this.isModalVisible = false;
    document.body.classList.remove('modal-open');

    this.editForm.reset();

    this.editForm.patchValue({
      authorizedType: 1,
    });

    this.validationErrors = {};
    this.additionalVisitorsErrors = {};

    Object.keys(this.editForm.controls).forEach((key) => {
      const control = this.editForm.get(key);
      control?.markAsUntouched();
      control?.markAsPristine();
    });

    if (this.timeRangeComponent) {
      this.timeRangeComponent.form.reset();
      this.timeRangeComponent.form.markAsPristine();
      this.timeRangeComponent.form.markAsUntouched();
      this.visitorService.clearAllowedDays();
    }

    this.selectedVisitor = {
      document: '',
      documentType: 0,
      userType: 0,
      name: '',
      last_name: '',
      email: '',
      authId: '',
      authRange: {
        init_date: new Date(),
        end_date: new Date(),
        allowedDays: [
          {
            day: '',
            init_hour: [0, 0],
            end_hour: [0, 0],
          },
        ],
        neighbor_id: 0,
      },
      vehicle: {
        id: 0,
        plate: '',
        vehicle_Type: {
          description: '',
        },
        insurance: '',
      },
      visitorId: 0,
    };
  }
  onIDFilterChange($event: FocusEvent) {
    const input = $event.target as HTMLInputElement;
    console.log('el valor cambio:', input.valueAsNumber);
    this.neighbor_id = input.valueAsNumber;
    this.fetchvisitors(); // Fetch new data when ID changes
  }
  onSearch(event: any) {
    const searchValue = event.target.value;

    //Comprobacion de 3 o mas caracteres (No me gusta pero a Santoro si :c)
    if (searchValue.length >= 3) {
      this.table.search(searchValue).draw();
    } else if (searchValue.length === 0) {
      this.table.search('').draw();
    }
  }

  onAuthorizedTypeChange(event: Event): void {
    const selectedValue = (event.target as HTMLSelectElement).value;
    if (selectedValue !== '') {
      this.indexUserType = parseInt(selectedValue, 10);
      this.updateemailcontrol();
    }
  }
  updateemailcontrol(): void {
    const emailControl = this.editForm.get('email');

    if (this.indexUserType === 1) {
      emailControl?.setValidators([
        Validators.required,
        Validators.email,
        Validators.maxLength(70),
      ]);
    } else {
      emailControl?.setValidators([Validators.email, Validators.maxLength(70)]);

      delete this.validationErrors['email'];
    }
    emailControl?.updateValueAndValidity();
  }
  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
