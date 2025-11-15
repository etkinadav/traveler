import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';

import { PreloginComponent } from '../auth/prelogin/prelogin.component';
import { DeleteOrderComponent } from './delete-order/delete-order.component';
import { DeleteUserComponent } from './delete-user/delete-user.component';
import { PhoneComponent } from './phone/phone.component';
import { CopyScanComponent } from './scan-copy/scan-copy.component';
import { SuEditUserComponent } from './su-edit-user/su-edit-user.component';
import { DeleteCartConfirmationComponent, DeleteCartConfirmationData } from './delete-cart-confirmation/delete-cart-confirmation.component';

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
  private dialogSuEditUserRef: MatDialogRef<SuEditUserComponent> | null = null;
  private dialogDeleteCartConfirmationRef: MatDialogRef<DeleteCartConfirmationComponent> | null = null;

  constructor(
    private dialog: MatDialog,
  ) { }

  // Login Dialog
  onOpenLoginDialog(): void {
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

  // =================
}

