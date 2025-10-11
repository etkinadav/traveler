import { Component, OnInit, OnDestroy } from '@angular/core';
import { DirectionService } from '../../direction.service';
import { Subscription } from 'rxjs';
import { DialogService } from 'src/app/dialog/dialog.service';
import { Router } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';

import { NgForm } from "@angular/forms";
import { FacebookLoginProvider, GoogleLoginProvider } from "@abacritt/angularx-social-login";

import { AuthService } from "../auth.service";
import { set } from 'lodash';

@Component({
  selector: 'app-prelogin',
  templateUrl: './prelogin.component.html',
  styleUrls: ['./prelogin.component.css'],
  host: {
    class: 'fill-screen-modal'
  },
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('800ms ease-in', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('800ms ease-out', style({ opacity: 0 }))
      ])
    ])
  ]
})

export class PreloginComponent implements OnInit, OnDestroy {
  isLoading: boolean = false;
  isDarkMode: boolean = false;
  isRTL: boolean = true;
  selectedLanguage: string = 'he';
  private directionSubscription: Subscription;
  loginStage: number = 0;
  private authStatusSub: Subscription;
  private emailCheckSubscription: Subscription;
  isEmailExists: string = '';
  email: string = '';

  signupHidePassword: boolean = true;
  loginHidePassword: boolean = true;
  passResetCodeHidePassword: boolean = true;
  passResetNewCode1HidePassword: boolean = true;
  passResetNewCode2HidePassword: boolean = true;

  passResetCode: string;
  isPassResetCodeSentToCheck: boolean = false;
  isPassResetCodeCorrect: boolean = false;
  newPass1: string;
  newPass2: string;
  isPassResetCodeAproved: boolean = false;

  provider: string = '';
  hasPassword: boolean = false;

  // משתנים לתמונות מתחלפות
  rotatingImages: string[] = [
    '../../../assets/images/ondi-example/ondi-example-beergarden.png',
    '../../../assets/images/ondi-example/ondi-example-flexable.png',
    '../../../assets/images/ondi-example/ondi-example-garden.png',
    '../../../assets/images/ondi-example/ondi-example-hangar.png',
    '../../../assets/images/ondi-example/ondi-example-inside.png',
    '../../../assets/images/ondi-example/ondi-example-kids.png'
  ];
  currentImageIndex: number = 0;
  private imageRotationInterval: any;

  constructor(
    private directionService: DirectionService,
    private dialogService: DialogService,
    private router: Router,
    public authService: AuthService
  ) {
    this.directionService.currentLanguage$.subscribe(lang => {
      this.selectedLanguage = lang;
    });
  };

  ngOnInit() {
    this.directionSubscription = this.directionService.direction$.subscribe(direction => {
      this.isRTL = direction === 'rtl';
    });

    this.directionService.isDarkMode$.subscribe(isDarkMode => {
      this.isDarkMode = isDarkMode;
    });

    this.authStatusSub = this.authService.getAuthStatusListener().subscribe(
      authStatus => {
        this.isLoading = false;
      }
    );

    // התחלת סיבוב התמונות
    this.startImageRotation();
  }

  ngOnDestroy() {
    this.directionSubscription.unsubscribe();
    this.authStatusSub.unsubscribe();
    this.stopImageRotation();
  }

  closeLoginDialog() {
    this.dialogService.onCloseLoginDialog();
  }

  goToTandC() {
    this.router.navigate(["/tandc"]);
    this.closeLoginDialog();
  }
  goToPP() {
    this.router.navigate(["/pp"]);
    this.closeLoginDialog();
  }

  toLoginStage(stage: number) {
    if (this.loginStage !== stage) {
      this.loginStage = stage;
      if (stage === 4) {
        this.isPassResetCodeSentToCheck = false;
        this.isPassResetCodeCorrect = false;
        // DOR NEW TASK!
        console.log('DOR NEW TASK! | SEND TO USER RESER PASSWORD!');
        console.log('DOR (1) | plz send to user with email:', this.email);
        console.log('DOR (2) | an 8 digits code (only numbers!) to email');
      }
    }
  }

  onEnterMail(form: NgForm) {
    if (form.invalid) {
      return;
    }
    this.isLoading = true;
    this.email = form.value.email;
    this.emailCheckSubscription = this.authService.checkEmail(form.value.email)
      .subscribe(
        (response: any) => {
          this.isEmailExists = response.exists;
          this.isLoading = false;
          if (this.isEmailExists) {
            this.provider = response.provider;
            this.hasPassword = response.hasPassword;
            if (this.provider === 'local' || this.hasPassword) {
              console.log("Local login");
              this.loginStage = 2;
            } else if (this.provider === 'facebook') {
              console.log("Facebook login");
              this.signInWithFB();
              this.closeLoginDialog();
            } else if (this.provider === 'google') {
              console.log("Google login");
              this.closeLoginDialog();
            } else {
              console.log("Other login");
              this.closeLoginDialog();
            }
          } else {
            this.loginStage = 3;
          }
        },
        (error) => {
          console.log("Error checking email:", error);
        }
      );
  }

  signInWithFB(): void {
    // this.authService.socialService.signIn(FacebookLoginProvider.PROVIDER_ID);
    this.authService.facebookLogin()
  }

  signInWithGoogle(): void {
    this.authService.googleLogin()
  }

  onLoginMail(form: NgForm) {
    if (form.invalid) {
      return;
    }
    this.isLoading = true;
    this.authService.login(this.email, form.value.password, 'local');
    this.isLoading = false;
  }

  onSignupMail(form: NgForm) {
    if (form.invalid) {
      return;
    }
    this.isLoading = true;
    this.authService.createUser(this.email, form.value.password, 'local');
    this.isLoading = false;
  }

  // toggle password view (EYE ICON)
  // login
  toggleLoginPasswordVisibility() {
    this.loginHidePassword = !this.loginHidePassword;
  }
  // Signup
  toggleSignupPasswordVisibility() {
    this.signupHidePassword = !this.signupHidePassword;
  }
  // PassResetCode
  togglePassResetCodeVisibility() {
    this.passResetCodeHidePassword = !this.passResetCodeHidePassword;
  }
  // pass01
  togglePassResetNewCode1Visibility() {
    this.passResetNewCode1HidePassword = !this.passResetNewCode1HidePassword;
  }
  // pass02
  togglePassResetNewCode2Visibility() {
    this.passResetNewCode2HidePassword = !this.passResetNewCode2HidePassword;
  }

  onSendPassResetCode(passResetCode: string) {
    this.isPassResetCodeSentToCheck = true;
    // DOR NEW TASK!
    console.log('DOR NEW TASK! | RESER PASSWORD - COMPERE 8 DIGITS!');
    console.log('DOR (1) | plz check for password reset for user with email:', this.email);
    console.log('DOR (2) | that enterded an 8 digits code (only numbers!):', this.passResetCode);
    setTimeout(() => {
      console.log("DOR (3) | and then execute the following code:");
      this.isPassResetCodeCorrect = true;
      this.isPassResetCodeSentToCheck = false;
    }, 2000);
  }

  onSendPassResetNewCode(newPass1: string, newPass2: string) {
    this.isPassResetCodeSentToCheck = true;
    this.isPassResetCodeAproved = false;
    // DOR NEW TASK!
    console.log('DOR NEW TASK! | RESER PASSWORD - SET NEW PASSWORD!');
    console.log('DOR (1) | plz set new password for user with email:', this.email);
    console.log('DOR (2) | and the password is:', newPass1);
    console.log('DOR (3) | and the password verification (wich shold work automaticly) is:', newPass2);
    setTimeout(() => {
      console.log("DOR (4) | and then execute the following code:");
      this.isPassResetCodeAproved = true;
      setTimeout(() => {
        this.isPassResetCodeAproved = false;
        this.loginStage = 2;
        this.isPassResetCodeSentToCheck = false;
      }, 1200);
    }, 2000);
  }

  isIphone(): boolean {
    return /iPhone/.test(navigator.userAgent);
  }

  // פונקציות לסיבוב התמונות
  startImageRotation(): void {
    this.imageRotationInterval = setInterval(() => {
      this.currentImageIndex = (this.currentImageIndex + 1) % this.rotatingImages.length;
    }, 4000); // החלפה כל 4 שניות
  }

  stopImageRotation(): void {
    if (this.imageRotationInterval) {
      clearInterval(this.imageRotationInterval);
      this.imageRotationInterval = null;
    }
  }

  // ==============
}
