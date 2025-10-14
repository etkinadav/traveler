import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModifyProductComponent } from './modify-product.component';
import { AngularMaterialModule } from '../../angular-material.module';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
    declarations: [ModifyProductComponent],
    imports: [CommonModule, FormsModule, AngularMaterialModule, TranslateModule],
    exports: [ModifyProductComponent]
})
export class ModifyProductModule { }
