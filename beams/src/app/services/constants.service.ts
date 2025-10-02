import { Injectable } from '@angular/core';
import { APP_CONSTANTS, WHATSAPP_NUMBER } from '../constants/app.constants';

@Injectable({
  providedIn: 'root'
})
export class ConstantsService {

  constructor() { }

  /**
   * Get WhatsApp number
   * @returns WhatsApp phone number as string
   */
  getWhatsAppNumber(): string {
    return WHATSAPP_NUMBER;
  }

  /**
   * Get all app constants
   * @returns Object containing all app constants
   */
  getAllConstants() {
    return APP_CONSTANTS;
  }

  /**
   * Get a specific constant by key
   * @param key - The key of the constant to retrieve
   * @returns The value of the constant or undefined if not found
   */
  getConstant(key: keyof typeof APP_CONSTANTS) {
    return APP_CONSTANTS[key];
  }
}
