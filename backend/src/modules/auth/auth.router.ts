import { ArkosRouter } from "arkos";
import { catchAsync, TooManyRequestsError } from "arkos/error-handler";
import authController from "./auth.controller";
import ForgotPasswordSchema from "./schemas/forgot-password.schema";
import ResetPasswordSchema from "./schemas/reset-password.schema";

// Arkos mounts this at /auth ahead of its own routes, so paths here are
// relative to that prefix and the built-in login/signup/etc. still exist.
const authRouter = ArkosRouter({
  openapi: { tags: ["Auth"] },
});

// express-rate-limit answers 429 with a plain-text body, which the client parses as
// JSON and chokes on before it can read the message. Throwing instead routes it through
// the error handler, so the refusal arrives in the same envelope as every other error.
const rateLimited = catchAsync(() => {
  throw new TooManyRequestsError(
    "Demasiados pedidos. Tente novamente mais tarde."
  );
});

authRouter.post(
  {
    path: "/forgot-password",
    authentication: false,
    validation: { body: ForgotPasswordSchema },
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      limit: 5,
      handler: rateLimited,
    },
  },
  authController.forgotPassword
);

authRouter.post(
  {
    path: "/reset-password",
    authentication: false,
    validation: { body: ResetPasswordSchema },
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      limit: 10,
      handler: rateLimited,
    },
  },
  authController.resetPassword
);

export default authRouter;
