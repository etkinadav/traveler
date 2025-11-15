import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ConstantsService } from '../../../services/constants.service';

@Component({
  selector: 'app-privacy-policy',
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.css'],
  host: {
    class: 'fill-screen'
  }
})
export class PrivacyPolicyComponent {
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
