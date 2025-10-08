import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-edit-product',
  templateUrl: './edit-product.component.html',
  styleUrls: ['./edit-product.component.css']
})
export class EditProductComponent implements OnInit {
  productName: string = '';
  modelName: string = '';
  productParams: any[] = [];
  hasModel: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<EditProductComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      productName: string;
      modelName: string;
      params: any[];
      product: any;
    }
  ) {
    this.productName = data.productName || '';
    this.modelName = data.modelName || '';
    this.productParams = data.params || [];
    this.hasModel = !!data.modelName;
  }

  ngOnInit(): void {
  }

  onClose(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    this.dialogRef.close({
      modelName: this.modelName
    });
  }

  // פונקציה להצגת ערך הפרמטר
  getParamDisplayValue(param: any): string {
    if (param.type === 'beamSingle' || param.type === 'beamArray') {
      // עבור קורות - הצג את סוג הקורה ואת סוג העץ
      const beamIndex = param.defaultType !== undefined ? param.defaultType : (param.selectedBeamIndex || 0);
      const typeIndex = param.selectedBeamTypeIndex || 0;
      
      if (param.beams && param.beams[beamIndex]) {
        const beam = param.beams[beamIndex];
        const beamName = beam.name || '';
        
        if (beam.types && beam.types[typeIndex]) {
          const woodType = beam.types[typeIndex].translatedName || beam.types[typeIndex].name || '';
          return `${beamName} - ${woodType}`;
        }
        return beamName;
      }
      return '-';
    } else if (param.type === 'beamArray' && param.default && Array.isArray(param.default)) {
      // עבור מערך מדפים
      return `${param.default.length} מדפים`;
    } else if (param.default !== undefined && param.default !== null) {
      // ערך רגיל
      return `${param.default} ${param.unit || ''}`;
    }
    return '-';
  }

  // פונקציה להצגת שם הפרמטר
  getParamDisplayName(param: any): string {
    return param.translatedName || param.name || '';
  }
}
