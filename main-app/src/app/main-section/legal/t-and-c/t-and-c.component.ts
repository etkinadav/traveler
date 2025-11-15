import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ConstantsService } from '../../../services/constants.service';

@Component({
  selector: 'app-t-and-c',
  templateUrl: './t-and-c.component.html',
  styleUrls: ['./t-and-c.component.css'],
  host: {
    class: 'fill-screen'
  }
})

export class TAndCComponent {
  constructor(
    private router: Router,
    private constantsService: ConstantsService
  ) { }

  navigateHome() {
    this.router.navigate(['/']);
  }

  openWhatsApp() {
    const phoneNumber = this.constantsService.getWhatsAppNumber();
    const message = encodeURIComponent(this.constantsService.getWhatsAppDefaultMessage());
    const url = `https://wa.me/${phoneNumber}?text=${message}`;
    window.open(url, '_blank');
  }
}
