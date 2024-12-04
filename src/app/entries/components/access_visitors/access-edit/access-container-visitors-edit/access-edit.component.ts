import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DatePipe } from '@angular/common';
import { CommonModule } from '@angular/common';
import $ from 'jquery';
import 'datatables.net';
import 'datatables.net-bs5';
import Swal from 'sweetalert2';
import { map, Subject, takeUntil } from 'rxjs';
import {
  AccessUser,
  UserType,
} from '../../../../models/access-visitors/access-visitors-models';
import {
  AccessUserAllowedInfoDto2,
  AccessDayOfWeek,
  AccessUserAllowedInfoDto,
  AuthRangeInfoDto,
  AccessApiAllowedDay,
} from '../../../../models/access-visitors/access-VisitorsModels';
import { AccessVisitorsRegisterServiceHttpClientService } from '../../../../services/access_visitors/access-visitors-register/access-visitors-register-service-http-client/access-visitors-register-service-http-client.service';
import { AccessVisitorsEditServiceService } from '../../../../services/access_visitors/access-visitors-edit/access-visitors-edit-service/access-visitors-edit-service.service';
import { AccessTimeRangeVisitorsEditComponent } from '../access-time-range-visitors-edit/access-time-range-visitors-edit.component';
import { AuthService } from '../../../../../users/users-servicies/auth.service';
import { MovementsService } from '../../../../services/access_report/access_httpclient/access_getMovementsByDate/movements.service';
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
  handleSelectedUser(user: AccessUser): void {
    this.user = user;
    console.log('Selected user:', this.user);
  }

  handleRangeSelected(range: {
    init_date: string;
    end_date: string;
    allowedDays: any[];
  }): void {
    this.editForm.patchValue({
      init_date: range.init_date,
      end_date: range.end_date,
      allowedDays: range.allowedDays,
    });
    console.log('Range selected:', range);
  }

  visitors: AccessUserAllowedInfoDto[] = [];
  allowedDays?: AccessApiAllowedDay[] = [];
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
  authRangeInfoDto?: AuthRangeInfoDto;

  @ViewChild(AccessTimeRangeVisitorsEditComponent)
  timeRangeComponent!: AccessTimeRangeVisitorsEditComponent;

  constructor(
    private datePipe: DatePipe,
    private fb: FormBuilder,
    private visitorHttpService: AccessVisitorsRegisterServiceHttpClientService,
    private visitorService: AccessVisitorsEditServiceService,
    private userService: AuthService
  ) {}

  // Selected visitor for editing
  selectedVisitor: AccessUserAllowedInfoDto = {
    document: '',
    name: '',
    last_name: '',
    email: '',
    vehicles: [
      {
        plate: '',
        vehicle_Type: {
          description: '',
        },
        insurance: '',
      },
    ],
    userType: {
      description: '',
    },
    authRanges: [
      {
        init_date: new Date(),
        end_date: new Date(),
        allowedDays: [
          {
            day: 'MONDAY', // Valor inicial, puede ser dinámico
            init_hour: '00:00:00',
            end_hour: '00:00:00',
          },
        ],
        neighbor_id: 0,
      },
    ],
    documentTypeDto: {
      description: '',
    },
    neighbor_id: 0, // Este valor inicial debería ajustarse a lo que sea necesario
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
  loadAllowedDays(): void {
    this.visitorService.getAllowedDays().subscribe(
      (days: AccessApiAllowedDay[]) => {
        this.allowedDays = days;
      },
      (error) => {
        console.error('Error loading allowed days:', error);
      }
    );
  }

  ngOnInit(): void {
    this.loadAllowedDays();
    this.setTodayDate();
    this.fetchUser();
    this.loadUsersType();
    this.fetchvisitors();
    this.initForm();
  }
  initForm(): void {
    this.editForm = this.fb.group({
      authorizedType: [{ disabled: true }, Validators.required],
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
      init_date: ['', Validators.required], // Asegúrate de incluir validaciones si es necesario
      end_date: ['', Validators.required],
      allowedDays: this.fb.array([], Validators.required),
    });
  }

  setTodayDate(): void {
    const currentDate = new Date();
    this.todayDate = this.datePipe.transform(currentDate, 'yyyy-MM-dd') || '';
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
      paging: true,
      ordering: true,
      pageLength: 5,
      lengthMenu: [5, 10, 25, 50],
      lengthChange: true,
      searching: true,
      info: true,
      autoWidth: false,
      language: {
        lengthMenu: ' _MENU_ ',
        zeroRecords: 'No se encontraron invitaciones',
        search: '',
        searchPlaceholder: 'Buscar',
        emptyTable: 'No hay invitaciones cargadas',
        info: '',
        infoEmpty: '',
        infoFiltered: '',
      },
      data: this.visitors,
      columns: [
        {
          data: 'authRanges',
          className: 'align-middle',
          render: (data) => {
            const initDate =
              data && data[0]
                ? this.datePipe.transform(data[0].init_date, 'dd/MM/yyyy')
                : '';
            return `<div>${initDate}</div>`;
          },
        },
        {
          data: 'authRanges',
          className: 'align-middle',
          render: (data) => {
            const endDate =
              data && data[0]
                ? this.datePipe.transform(data[0].end_date, 'dd/MM/yyyy')
                : '';
            return `<div>${endDate}</div>`;
          },
        },
        {
          data: null,
          className: 'align-middle',
          render: (data) => `<div>${data.name} ${data.last_name}</div>`,
        },
        {
          data: 'documentTypeDto.description',
          className: 'align-middle',
          render: (data) => `<div>${data || ''}</div>`,
        },
        {
          data: 'document',
          className: 'align-middle',
          render: (data) => `<div>${data || ''}</div>`,
        },
        {
          data: null,
          className: 'align-middle text-center',
          searchable: false,
          render: (data, type, row, meta) => `
            <button class="btn btn-primary btn-sm view-more-btn" data-index="${meta.row}">Editar</button>`,
        },
      ],
      dom: '<"mb-3"t><"d-flex justify-content-between"lp>',
    });
    this.table.draw();
  }

  onSubmit(): void {
    const formValues = this.editForm.value;

    this.selectedVisitor = {
      ...this.selectedVisitor,
      name: formValues.name,
      last_name: formValues.last_name,
      document: formValues.document,
      email: formValues.email,
      authRanges: [
        {
          init_date: formValues.init_date,
          end_date: formValues.end_date,
          allowedDays: formValues.allowedDays,
          neighbor_id: this.selectedVisitor.authRanges[0]?.neighbor_id || 0,
        },
      ],
    };

    console.log('Updated Visitor:', this.selectedVisitor);

    this.saveVisitorChanges(this.selectedVisitor);
    this.hideModal();
  }

  saveVisitorChanges(visitor: AccessUserAllowedInfoDto): void {
    // Aquí puedes hacer una petición al servidor o actualizar localmente
    console.log('Saving visitor:', visitor);

    // Ejemplo: Actualización local de la tabla (si está en un arreglo)
    const index = this.visitors.findIndex(
      (v) => v.document === visitor.document
    );
    if (index !== -1) {
      this.visitors[index] = { ...visitor };
    }

    console.log('Updated visitors list:', this.visitors);
    console.log("FORMULARIO",this.editForm.value);
    
    this.saveAllVisitors();
  }

  fetchvisitors(): void {
    const neighbor = this.user.id;
    console.log('Vecino:', neighbor);
    this.visitorHttpService.fetchVisitorsByNeighbor(neighbor).subscribe({
      next: (response) => {
        this.visitors = response;
        console.log('Visitantes:', response);
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

  formatDateForInput(date: Date | string | undefined): string {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return this.datePipe.transform(dateObj, 'yyyy-MM-dd') || '';
  }





  saveAllVisitors(): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: '¿Deseas actualizar estos visitantes?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, actualizar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        // First, get the auth range and allowed days
        this.visitorService.getAuthRange().subscribe(
          (authRangeInfo) => {
            if (authRangeInfo) {
              this.visitorService.getAllowedDays().pipe(
                map(allowedDays => {
                  authRangeInfo.allowedDays = allowedDays;
                  const updatedVisitor: AccessUserAllowedInfoDto2 = {
                    document: this.selectedVisitor.document,
                    documentType: this.selectedVisitor.documentType,
                    userType: this.editForm.get('authorizedType')?.value,
                    name: this.selectedVisitor.name,
                    last_name: this.selectedVisitor.last_name,
                    email: this.selectedVisitor.email,
                    authId: this.selectedVisitor.authId,
                    authRange: {
                      ...this.selectedVisitor.authRange,
                      allowedDays: allowedDays.map(day => ({
                        day: day.day,
                        init_hour: day.init_hour,
                        end_hour: day.end_hour
                      }))
                    },
                    vehicle: this.selectedVisitor.vehicle,
                    visitorId: this.selectedVisitor.visitorId,
                  };
  
                  return updatedVisitor;
                })
              ).subscribe(
                (updatedVisitor) => {
                  console.log(updatedVisitor, "UPDATED VISITORRR");
                  
                  this.visitorHttpService.updateVisitor(updatedVisitor,updatedVisitor.document,updatedVisitor.documentType.toString()).subscribe({
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
              );
            }
          }
        );
      }
    });
  }

  editVisitor(visitor: AccessUserAllowedInfoDto): void {
    this.selectedVisitor = visitor;
    console.log('Selected Visitor:', this.selectedVisitor);
    console.log('Visitor UserType:', visitor.userType);
    console.log('Available Types:', this.usersType);
    //this.indexUserType = this.selectedVisitor.userType;
    this.updateemailcontrol();
    // Update form with visitor data
    this.editForm.patchValue({
      authorizedType: visitor.userType,
      name: visitor.name,
      last_name: visitor.last_name,
      document: visitor.document,
      email: visitor.email,
      init_date: this.formatDateForInput(visitor.authRanges[0]?.init_date),
      end_date: this.formatDateForInput(visitor.authRanges[0]?.end_date),
      allowedDays: allowedDaysArray, // Carga el arreglo completo
    });

    this.showModal();
  }

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

    Object.keys(this.editForm.controls).forEach((key) => {
      const control = this.editForm.get(key);
      control?.markAsUntouched();
      control?.markAsPristine();
    });

    if (this.timeRangeComponent) {
      // this.timeRangeComponent.form.reset();
      // this.timeRangeComponent.form.markAsPristine();
      // this.timeRangeComponent.form.markAsUntouched();
      this.visitorService.clearAllowedDays();
    }

    this.selectedVisitor = {
      document: '',
      name: '',
      last_name: '',
      email: '',
      vehicles: [
        {
          plate: '',
          vehicle_Type: {
            description: '',
          },
          insurance: '',
        },
      ],
      userType: {
        description: '',
      },
      authRanges: [
        {
          init_date: new Date(),
          end_date: new Date(),
          allowedDays: [
            {
              day: 'MONDAY',
              init_hour: '00:00:00',
              end_hour: '00:00:00',
            },
          ],
          neighbor_id: 0,
        },
      ],
      documentTypeDto: {
        description: '',
      },
      neighbor_id: 0,
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
    }
    emailControl?.updateValueAndValidity();
  }
  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
  private userTypeTranslations: { [key: string]: string } = {
    Visitor: 'Visitante',
    Worker: 'Obrero',
    Delivery: 'Delivery',
    Taxi: 'Taxi',
    Cleaning: 'Personal de limpieza',
    Gardener: 'Jardinero',
  };

  userTypes = [
    { id: 1, description: 'Visitante' },
    { id: 7, description: 'Obrero' },
    { id: 8, description: 'Delivery' },
    { id: 9, description: 'Taxi' },
    { id: 10, description: 'Personal de limpieza' },
    { id: 11, description: 'Jardinero' },
  ];

  getUserTypeDescription(userType: { description: string } | number): string {
    if (typeof userType === 'object' && userType.description) {
      const translatedDescription =
        this.userTypeTranslations[userType.description] || userType.description;
      return translatedDescription;
    }
    return '';
  }
}
