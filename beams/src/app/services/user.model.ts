export interface User {
  id: string;
  email: string;
  printingService: string;
  branch: string;
  provider: string;
  language: string;
  home_printingServices_list: string[];
  home_branches_list: string[];
  displayName?: string;
  phone?: string;
  roles?: string[];
  discount?: number;
  points?: number;
  zCreditInfo?: any;
}
