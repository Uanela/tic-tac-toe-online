import { ArkosNextFunction, ArkosRequest, ArkosResponse } from "arkos";
import { SignupSchemaType } from "./schemas/signup.schema";
import { ArkosPrismaInput } from "arkos/prisma";
import { Prisma } from "@prisma/client";
import { emailService } from "arkos/services";
import { welcomeEmail } from "../game/utils/email-templates/welcome.email";
import authService from "./auth.service";

class AuthController {
  async forgotPassword(req: ArkosRequest, res: ArkosResponse) {
    await authService.requestPasswordReset(req.body.email);

    res.status(200).json({
      status: "success",
      message: "Código de recuperação enviado.",
    });
  }

  async resetPassword(req: ArkosRequest, res: ArkosResponse) {
    const { email, otp, newPassword } = req.body;

    await authService.resetPassword(email, otp, newPassword);

    res.status(200).json({
      status: "success",
      message: "Palavra-passe alterada com sucesso.",
    });
  }

  async beforeSignup(
    req: ArkosRequest<
      any,
      any,
      SignupSchemaType & ArkosPrismaInput<Prisma.UserCreateInput>
    >,
    _: ArkosResponse,
    next: ArkosNextFunction
  ) {
    req.body = {
      ...req.body,
      role: "Player",
      player: {
        ...req.body.player,
        // Preferences hang off this row and nothing a Player may call creates
        // one, so it is born with the account.
        settings: { create: {} },
      },
    };

    next();
  }

  async afterSignup(
    req: ArkosRequest<
      any,
      any,
      SignupSchemaType & ArkosPrismaInput<Prisma.UserCreateInput>
    >,
    _: ArkosResponse,
    next: ArkosNextFunction
  ) {
    emailService
      .send({ to: req.body.email, ...welcomeEmail(req.body.player) })
      .catch(console.error);

    next();
  }
}

const authController = new AuthController();

export default authController;
