import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';

import { PreloginComponent } from '../auth/prelogin/prelogin.component';
import { DeleteOrderComponent } from './delete-order/delete-order.component';
import { DeleteUserComponent } from './delete-user/delete-user.component';
import { PhoneComponent } from './phone/phone.component';
import { CopyScanComponent } from './scan-copy/scan-copy.component';
import { PropertyExplainComponent } from './property-explain/property-explain.component';
import { SuEditUserComponent } from './su-edit-user/su-edit-user.component';
import { DeleteCartConfirmationComponent, DeleteCartConfirmationData } from './delete-cart-confirmation/delete-cart-confirmation.component';
import { ProductEditInfoComponent, ProductEditInfoData } from './product-edit-info/product-edit-info.component';

@Injectable({
  providedIn: 'root'
})
export class DialogService {
  private dialogLoginRef: MatDialogRef<PreloginComponent> | null = null;
  private dialogDeleteOrderRef: MatDialogRef<DeleteOrderComponent> | null = null;
  private dialogDeleteUserRef: MatDialogRef<DeleteUserComponent> | null = null;
  private closeResizeDialogSource = new Subject<void>();
  closeResizeDialog$ = this.closeResizeDialogSource.asObservable();
  private dialogPhoneRef: MatDialogRef<PhoneComponent> | null = null;
  private dialogCopyScanRef: MatDialogRef<CopyScanComponent> | null = null;
  private dialogPropertyExplainRef: MatDialogRef<PropertyExplainComponent> | null = null;
  private dialogSuEditUserRef: MatDialogRef<SuEditUserComponent> | null = null;
  private dialogDeleteCartConfirmationRef: MatDialogRef<DeleteCartConfirmationComponent> | null = null;
  private dialogProductEditInfoRef: MatDialogRef<ProductEditInfoComponent> | null = null;

  constructor(
    private dialog: MatDialog,
  ) { }

  // Login Dialog
  onOpenLoginDialog(printingService: string = '', branch: string = ''): void {
    if (printingService && printingService !== '' && branch && branch !== '') {
      localStorage.setItem("printingService", printingService);
      localStorage.setItem("branch", branch);
    }
    this.dialogLoginRef = this.dialog.open(PreloginComponent, {
      panelClass: 'zx-login-dialog',
    });
  }

  onCloseLoginDialog(): void {
    this.dialogLoginRef.close();
  }






  // delete order
  onOpenDeleteOrderDialog(
    order,
    isSu: boolean = false
  ): void {
    this.dialogDeleteOrderRef = this.dialog.open(DeleteOrderComponent, {
      panelClass: 'zx-printer-number-dialog',
      data: {
        order: order,
        isSu: isSu,
      }
    });
  }

  onCloseDeleteOrderDialog(): void {
    this.dialogDeleteOrderRef.close();
  }

  // delete user
  onOpenDeleteUserDialog(
    user,
  ): void {
    this.dialogDeleteUserRef = this.dialog.open(DeleteUserComponent, {
      panelClass: 'zx-printer-number-dialog',
      data: {
        user: user,
      }
    });
  }

  onCloseDeleteUserDialog(): void {
    this.dialogDeleteUserRef.close();
  }



  // Phone Dialog
  onOpenPhoneDialog(): void {
    this.dialogPhoneRef = this.dialog.open(PhoneComponent, {
      panelClass: 'zx-phone-dialog',
    });
  }

  onClosePhoneDialog(): void {
    this.dialogPhoneRef.close();
  }

  // Scan Copy Dialog
  onOpenScanCopyDialog(expressBranch: any): void {
    this.dialogCopyScanRef = this.dialog.open(CopyScanComponent, {
      panelClass: 'zx-scan-copy-dialog',
      data: {
        expressBranch: expressBranch,
      }
    });
  }

  onCloseScanCopyDialog(): void {
    this.dialogCopyScanRef.close();
  }


  // Property Explain Dialog
  onOpenExplainPropertyDialog(
    property: string,
    printingService: string,
    realBranch: any,
  ): void {
    this.dialogPropertyExplainRef = this.dialog.open(PropertyExplainComponent, {
      panelClass: 'zx-property-explain-dialog',
      data: {
        property: property,
        printingService: printingService,
        realBranch: realBranch,
      }
    });
  }

  onCloseExplainPropertyDialog(): void {
    this.dialogPropertyExplainRef.close();
  }




  // Su Edit User Dialog
  onOpenSuEditUserDialog(
    user: any,
  ): void {
    this.dialogSuEditUserRef = this.dialog.open(SuEditUserComponent, {
      panelClass: 'zx-printer-number-dialog',
      data: {
        user: user,
      }
    });
  }

  onCloseSuEditUserDialog(): void {
    this.dialogSuEditUserRef.close();
  }

  // Delete Cart Confirmation Dialog
  onOpenDeleteCartConfirmationDialog(data: DeleteCartConfirmationData): Promise<boolean> {
    this.dialogDeleteCartConfirmationRef = this.dialog.open(DeleteCartConfirmationComponent, {
      panelClass: 'fill-screen-modal-phone',
      data: data,
      disableClose: false
    });

    return this.dialogDeleteCartConfirmationRef.afterClosed().toPromise().then(result => {
      return result === true; // true = המשתמש אישר, false = ביטל
    });
  }

  onCloseDeleteCartConfirmationDialog(): void {
    if (this.dialogDeleteCartConfirmationRef) {
      this.dialogDeleteCartConfirmationRef.close();
    }
  }

  // Product Edit Info Dialog
  onOpenProductEditInfoDialog(productData: ProductEditInfoData): void {
    console.log('SAVE_PRO - DialogService opening ProductEditInfo dialog');
    console.log('SAVE_PRO - Dialog data summary:', JSON.stringify({
      hasProduct: !!productData?.product,
      productId: productData?.product?._id || productData?.product?.id || 'NO_ID',
      productName: productData?.product?.name || 'NO_NAME',
      hasCurrentParams: !!productData?.currentParams,
      paramsCount: productData?.currentParams?.length || 0,
      hasCurrentConfiguration: !!productData?.currentConfiguration,
      configurationName: productData?.currentConfiguration?.translatedName || productData?.currentConfiguration?.name || 'NO_CONFIG',
      timestamp: productData?.timestamp || 'NO_TIMESTAMP'
    }, null, 2));
    
    this.dialogProductEditInfoRef = this.dialog.open(ProductEditInfoComponent, {
      panelClass: 'zx-product-edit-info-dialog',
      data: productData,
      maxWidth: '95vw',
      width: 'auto',
      maxHeight: '90vh',
      minWidth: '800px'
    });
    
    console.log('SAVE_PRO - ProductEditInfo dialog opened successfully');
  }

  onCloseProductEditInfoDialog(): void {
    console.log('SAVE_PRO - DialogService closing ProductEditInfo dialog');
    if (this.dialogProductEditInfoRef) {
      this.dialogProductEditInfoRef.close();
      console.log('SAVE_PRO - ProductEditInfo dialog closed successfully');
    } else {
      console.log('SAVE_PRO - WARNING: No ProductEditInfo dialog reference found to close');
    }
  }

  // =================
}

