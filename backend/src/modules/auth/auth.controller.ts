import { ArkosNextFunction, ArkosRequest, ArkosResponse } from "arkos";
import { SignupSchemaType } from "./schemas/signup.schema";
import { ArkosPrismaInput } from "arkos/prisma";
import { Prisma } from "@prisma/client";

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
}

const authController = new AuthController();

export default authController;
