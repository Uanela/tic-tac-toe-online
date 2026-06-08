import authController from "./auth.controller";

export const beforeGetMe = [];

export const afterGetMe = [];

export const onGetMeError = [];

export const beforeLogin = [];

export const afterLogin = [];

export const onLoginError = [];

export const beforeLogout = [];

export const afterLogout = [];

export const onLogoutError = [];

export const beforeSignup = [authController.beforeSignup];

export const afterSignup = [authController.afterSignup];

export const onSignupError = [];

export const beforeUpdatePassword = [];

export const afterUpdatePassword = [];

export const onUpdatePasswordError = [];
