import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { NgModule } from "@angular/core";
import { HttpClient, HttpClientModule, HTTP_INTERCEPTORS } from "@angular/common/http";

import { AppComponent } from "./app.component";
import { AppRoutingModule } from "./app-routing.module";
import { AuthInterceptor } from "./auth/auth-interceptor";
import { ErrorInterceptor } from "./error-interceptor";
import { ErrorComponent } from "./error/error.component";
import { AngularMaterialModule } from "./angular-material.module";

import { MainNavComponent } from './main-nav/main-nav.component';

import { BidiModule } from "@angular/cdk/bidi";

import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { PreloginComponent } from "./auth/prelogin/prelogin.component";
import { SocialComponent } from "./auth/social/social.component";
import { TAndCComponent } from "./main-section/legal/t-and-c/t-and-c.component";
import { PrivacyPolicyComponent } from "./main-section/legal/privacy-policy/privacy-policy.component";


import { CommonModule } from "@angular/common";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import { DeleteOrderComponent } from "./dialog/delete-order/delete-order.component";
import { DeleteUserComponent } from "./dialog/delete-user/delete-user.component";
import { MyOrdersComponent } from "./other-pages/my-orders/my-orders.component";
import { MyProfileComponent } from "./other-pages/my-profile/my-profile.component";
import { QAndAComponent } from "./other-pages/q-and-a/q-and-a.component";
import { PhoneComponent } from "./dialog/phone/phone.component";
import { CopyScanComponent } from "./dialog/scan-copy/scan-copy.component";
import { SuEditUserComponent } from "./dialog/su-edit-user/su-edit-user.component";
import { DeleteCartConfirmationComponent } from "./dialog/delete-cart-confirmation/delete-cart-confirmation.component";
import { HomeComponent } from "./home/home.component";
import { TranslatorComponent } from "./translator/translator.component";

@NgModule({
  declarations: [
    AppComponent,
    ErrorComponent,
    MainNavComponent,
    HomeComponent,
    TranslatorComponent,
    MyOrdersComponent,
    MyProfileComponent,
    QAndAComponent,
    PreloginComponent,
    SocialComponent,
    TAndCComponent,
    PrivacyPolicyComponent,
    PhoneComponent,
    CopyScanComponent,
    DeleteOrderComponent,
    DeleteUserComponent,
    SuEditUserComponent,
    DeleteCartConfirmationComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    HttpClientModule,
    AngularMaterialModule,
    BidiModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: (http: HttpClient) =>
          new TranslateHttpLoader(http, './assets/i18n/', `.json?v=${new Date().getTime()}`),
        deps: [HttpClient],
      },
    }),
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    // SocialLoginModule,
    // GoogleSigninButtonModule
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
    { provide: 'Direction', useValue: 'ltr' }, // or 'rtl' depending on default direction
    // {
    //   provide: 'SocialAuthServiceConfig',
    //   useValue: {
    //     autoLogin: false,
    //     providers: [
    //       {
    //         id: GoogleLoginProvider.PROVIDER_ID,
    //         provider: new GoogleLoginProvider(
    //           '101384619367-jrfc9unrqatdfnlh5rjre0uu4sl5anc8.apps.googleusercontent.com'
    //         )
    //       },
    //       {
    //         id: FacebookLoginProvider.PROVIDER_ID,
    //         provider: new FacebookLoginProvider('415210939050964')
    //       }
    //     ],
    //     onError: (err) => {
    //       console.error(err);
    //     }
    //   } as SocialAuthServiceConfig,
    // }
  ],
  bootstrap: [AppComponent],
})
export class AppModule { }

export function HttpLoaderFactory(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http);
}
