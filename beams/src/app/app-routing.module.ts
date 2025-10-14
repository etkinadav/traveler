import { ModifyProductComponent } from './main-section/modify-product/modify-product.component';
import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { ChooseProductComponent } from "./main-section/choose-product/choose-product.component"

import { SocialComponent } from "./auth/social/social.component";

import { AuthGuard } from "./auth/auth.guard";
import { TAndCComponent } from "./main-section/legal/t-and-c/t-and-c.component"
import { PrivacyPolicyComponent } from "./main-section/legal/privacy-policy/privacy-policy.component"



import { MyOrdersComponent } from "./other-pages/my-orders/my-orders.component";
import { MyProfileComponent } from "./other-pages/my-profile/my-profile.component";
import { QAndAComponent } from "./other-pages/q-and-a/q-and-a.component";



const routes: Routes = [
    { path: "", component: ChooseProductComponent },

    { path: "beams", component: ModifyProductComponent },

    { path: "myorders/:userId", component: MyOrdersComponent },
    { path: "myprofile/:userId", component: MyProfileComponent },
    { path: "myprofile/:userId/credit", component: MyProfileComponent },
    { path: "qanda", component: QAndAComponent },
    { path: "tandc", component: TAndCComponent },
    { path: "pp", component: PrivacyPolicyComponent },

    { path: "social", component: SocialComponent },


    // errors:
    { path: '**', redirectTo: '/' },
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule],
    providers: [AuthGuard]
})
export class AppRoutingModule { }
