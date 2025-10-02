export const APP_CONSTANTS = {
  // WhatsApp Configuration
  WHATSAPP_NUMBER: '547840789',
  
  // Add more constants here as needed
  // Example:
  // API_ENDPOINTS: {
  //   BASE_URL: 'https://api.example.com',
  //   USERS: '/users',
  //   ORDERS: '/orders'
  // },
  // 
  // UI_CONFIG: {
  //   MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  //   SUPPORTED_FORMATS: ['jpg', 'jpeg', 'png', 'pdf']
  // }
} as const;

// Export individual constants for easier access
export const WHATSAPP_NUMBER = APP_CONSTANTS.WHATSAPP_NUMBER;
