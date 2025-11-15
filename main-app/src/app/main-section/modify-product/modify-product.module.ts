import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModifyProductComponent } from './modify-product.component';
import { AngularMaterialModule } from '../../angular-material.module';
import { TranslateModule } from '@ngx-translate/core';
import { DrawingComponent } from '../drawing/drawing.component';

@NgModule({
    declarations: [ModifyProductComponent, DrawingComponent],
    imports: [CommonModule, FormsModule, AngularMaterialModule, TranslateModule],
    exports: [ModifyProductComponent]
})
export class ModifyProductModule { }
