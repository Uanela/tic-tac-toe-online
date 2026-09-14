import { AuthService as ArkosAuthService, emailService } from "arkos/services";
import { AppError } from "arkos/error-handler";
import { randomInt } from "node:crypto";
import { prisma } from "../../utils/prisma";
import {
  passwordResetConfirmationEmail,
  passwordResetOtpEmail,
} from "./utils/email-templates/password-reset.email";

const OTP_TTL_MINUTES = 15;
const OTP_TTL_MS = OTP_TTL_MINUTES * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

export class AuthService extends ArkosAuthService {
  async requestPasswordReset(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        isActive: true,
        deletedSelfAccountAt: true,
        player: { select: { nickname: true } },
      },
    });

    if (!user || !user.isActive || user.deletedSelfAccountAt)
      throw new AppError("Nenhuma conta encontrada com este email.", 404);

    // crypto, not Math.random: the code is the only proof of ownership, and a
    // sequence a caller could predict would hand over any account.
    const otp = randomInt(100000, 1000000).toString();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetOtp: otp,
        passwordResetOtpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
        passwordResetOtpAttempts: 0,
      },
    });

    try {
      await emailService.send({
        to: user.email,
        ...passwordResetOtpEmail(user.player, otp, OTP_TTL_MINUTES),
      });
    } catch (err) {
      // The code is live but nobody received it, so clear it rather than leave
      // the account holding a reset the user cannot complete.
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetOtp: null, passwordResetOtpExpiresAt: null },
      });
      throw err;
    }
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        isActive: true,
        deletedSelfAccountAt: true,
        passwordResetOtp: true,
        passwordResetOtpExpiresAt: true,
        passwordResetOtpAttempts: true,
        player: { select: { nickname: true } },
      },
    });

    if (!user || !user.isActive || user.deletedSelfAccountAt)
      throw new AppError("Nenhuma conta encontrada com este email.", 404);

    if (!user.passwordResetOtp || !user.passwordResetOtpExpiresAt)
      throw new AppError(
        "Peça um código de recuperação antes de continuar.",
        400,
        "no_otp_requested"
      );

    if (Date.now() > user.passwordResetOtpExpiresAt.getTime())
      throw new AppError(
        "O código expirou. Peça um novo.",
        400,
        "expired_otp"
      );

    if (otp !== user.passwordResetOtp) {
      const attempts = user.passwordResetOtpAttempts + 1;
      const exhausted = attempts >= MAX_OTP_ATTEMPTS;

      // Guessing burns the code: past the limit the OTP is gone, so the window
      // closes on the attacker instead of staying open for the full TTL.
      await prisma.user.update({
        where: { id: user.id },
        data: exhausted
          ? {
              passwordResetOtp: null,
              passwordResetOtpExpiresAt: null,
              passwordResetOtpAttempts: 0,
            }
          : { passwordResetOtpAttempts: attempts },
      });

      throw new AppError(
        exhausted
          ? "Demasiadas tentativas. Peça um novo código."
          : "Código inválido.",
        exhausted ? 429 : 400,
        exhausted ? "too_many_otp_attempts" : "invalid_otp"
      );
    }

    if (await this.isCorrectPassword(newPassword, user.password))
      throw new AppError(
        "A nova palavra-passe tem de ser diferente da atual.",
        400,
        "new_password_equals_current_password"
      );

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await this.hashPassword(newPassword),
        passwordResetOtp: null,
        passwordResetOtpExpiresAt: null,
        passwordResetOtpAttempts: 0,
        passwordChangedAt: new Date(),
      },
    });

    emailService
      .send({
        to: user.email,
        ...passwordResetConfirmationEmail(user.player),
      })
      .catch(console.error);
  }
}

const authService = new AuthService();

export default authService;
