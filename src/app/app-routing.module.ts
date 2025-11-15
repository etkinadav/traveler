import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { ChooseServiceComponent } from "./choose-service/choose-service.component";

import { SocialComponent } from "./auth/social/social.component";

import { AuthGuard } from "./auth/auth.guard";

import { MyOrdersComponent } from "./other-pages/my-orders/my-orders.component";
import { MyProfileComponent } from "./other-pages/my-profile/my-profile.component";
import { QAndAComponent } from "./other-pages/q-and-a/q-and-a.component";



const routes: Routes = [
    { path: "", component: ChooseServiceComponent },

    { path: "myorders/:userId", component: MyOrdersComponent },
    { path: "myprofile/:userId", component: MyProfileComponent },
    { path: "myprofile/:userId/credit", component: MyProfileComponent },
    { path: "qanda", component: QAndAComponent },
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
