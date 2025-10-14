import { ThreejsBoxComponent } from './threejs-box/threejs-box.component';
import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { ChoosePrintingSystemComponent } from "./main-section/choose-printing-system/choose-printing-system.component"

import { SocialComponent } from "./auth/social/social.component";

import { AuthGuard } from "./auth/auth.guard";
import { TAndCComponent } from "./main-section/legal/t-and-c/t-and-c.component"
import { PrivacyPolicyComponent } from "./main-section/legal/privacy-policy/privacy-policy.component"



import { MyOrdersComponent } from "./other-pages/my-orders/my-orders.component";
import { MyProfileComponent } from "./other-pages/my-profile/my-profile.component";
import { PrintingQueComponent } from "./other-pages/printing-que/printing-que.component";
import { QAndAComponent } from "./other-pages/q-and-a/q-and-a.component";
import { PendingOrderComponent } from "./other-pages/pending-order/pending-order.component";



const routes: Routes = [
    { path: "", component: ChoosePrintingSystemComponent },

    { path: "beams", component: ThreejsBoxComponent },

    { path: "myorders/:userId", component: MyOrdersComponent },
    { path: "myprofile/:userId", component: MyProfileComponent },
    { path: "queue/:branch", component: PrintingQueComponent },
    { path: "myprofile/:userId/credit", component: MyProfileComponent },
    { path: "qanda", component: QAndAComponent },
    { path: "x/:service/:orderId", component: PendingOrderComponent },
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
