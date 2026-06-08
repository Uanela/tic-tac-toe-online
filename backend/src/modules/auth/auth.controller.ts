import { ArkosNextFunction, ArkosRequest, ArkosResponse } from "arkos";
import { SignupSchemaType } from "./schemas/signup.schema";
import { ArkosPrismaInput } from "arkos/prisma";
import { Prisma } from "@prisma/client";
import { emailService } from "arkos/services";
import { welcomeEmail } from "../game/utils/email-templates/welcome.email";

class AuthController {
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
