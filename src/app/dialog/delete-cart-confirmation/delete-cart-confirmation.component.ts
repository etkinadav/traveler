import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';

export interface DeleteCartConfirmationData {
  type: 'item' | 'cart'; // האם זה מחיקת פריט בודד או כל הסל
  itemName?: string; // שם הפריט (רק אם זה מחיקת פריט בודד)
}

@Component({
  selector: 'app-delete-cart-confirmation',
  templateUrl: './delete-cart-confirmation.component.html',
  styleUrls: ['./delete-cart-confirmation.component.css']
})
export class DeleteCartConfirmationComponent {
  isRTL: boolean = true;

  constructor(
    public dialogRef: MatDialogRef<DeleteCartConfirmationComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DeleteCartConfirmationData,
    private translate: TranslateService
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true); // true = המשתמש אישר את המחיקה
  }

  onCancel(): void {
    this.dialogRef.close(false); // false = המשתמש ביטל את המחיקה
  }

  getTitle(): string {
    if (this.data.type === 'cart') {
      return this.translate.instant('delete-cart.title');
    } else {
      return this.translate.instant('delete-cart.title-item');
    }
  }

  getMessage(): string {
    if (this.data.type === 'cart') {
      return this.translate.instant('delete-cart.explain-cart');
    } else {
      return this.translate.instant('delete-cart.explain-item', { itemName: this.data.itemName });
    }
  }

  getDeleteButtonText(): string {
    if (this.data.type === 'cart') {
      return this.translate.instant('delete-cart.btn-delete-cart');
    } else {
      return this.translate.instant('delete-cart.btn-delete-item');
    }
  }

  getCancelButtonText(): string {
    return this.translate.instant('delete-cart.btn-cancel');
  }
}
