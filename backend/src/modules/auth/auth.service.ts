import { AuthService as ArkosAuthService } from "arkos/services";
  
export class AuthService extends ArkosAuthService {}

const authService = new AuthService();

export default authService;
