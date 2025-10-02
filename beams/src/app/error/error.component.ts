import { Component, Inject, OnInit, OnDestroy } from "@angular/core";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { DirectionService } from "../direction.service";
import { Subscription } from "rxjs";
import { ConstantsService } from "../services/constants.service";

@Component({
    templateUrl: './error.component.html',
    styleUrls: ['./error.component.scss'],
    host: {
        class: 'fill-screen-modal'
    }
})

export class ErrorComponent {
    isRTL: boolean = true;
    private directionSubscription: Subscription;
    isDarkMode: boolean = false;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: { message: string },
        private directionService: DirectionService,
        private constantsService: ConstantsService,
    ) { }

    ngOnInit() {
        this.directionSubscription = this.directionService.direction$.subscribe(direction => {
            this.isRTL = direction === 'rtl';
        });

        this.directionService.isDarkMode$.subscribe(isDarkMode => {
            this.isDarkMode = isDarkMode;
        });
    }

    ngOnDestroy() {
        this.directionSubscription.unsubscribe();
    }

    openWhatsApp() {
        const phoneNumber = this.constantsService.getWhatsAppNumber();
        const message = encodeURIComponent(this.constantsService.getWhatsAppDefaultMessage());
        const url = `https://wa.me/${phoneNumber}?text=${message}`;
        window.open(url, '_blank');
    }
}