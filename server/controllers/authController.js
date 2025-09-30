import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import { User } from "../models/userModel.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendVerificationCode } from "../utils/sendVerificationCode.js";
import { sendToken } from "../utils/sendToken.js";
import { generateForgotPasswordEmailTemplate } from "../utils/emailTemplates.js";
import { sendEmail } from "../utils/sendEmail.js";

export const register = catchAsyncErrors(async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return next(new ErrorHandler("please enter all fields", 400));
    }
    const isRegistered = await User.findOne({ email, accountVerified: true });
    if (isRegistered) {
      return next(new ErrorHandler("User already exists", 400));
    }
    const registerationAttemptsByUser = await User.find({
      email,
      accountVerified: false,
    });
    if (registerationAttemptsByUser.length >= 5) {
      return next(
        new ErrorHandler(
          "you have exceeded the number of registration attempt. please contact support.",
          400
        )
      );
    }
    if (password.length < 8 || password.length > 16) {
      return next(
        new ErrorHandler("password must be between 8 and 16 charecters.", 400)
      );
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });
    const verificationCode = await user.generateVerificationCode();
    await user.save();
    sendVerificationCode(verificationCode, email, res);
  } catch (error) {
    next(error);
  }
});

export const verifyOtp = catchAsyncErrors(async (req, res, next) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return next(new ErrorHandler("email or otp  is missing.", 400));
  }
  try {
    const userAllEntries = await User.find({
      email,
      accountVerified: false,
    }).sort({ createdAt: -1 });

    if (!userAllEntries) {
      return next(new ErrorHandler("user not found", 404));
    }

    let user;

    if (userAllEntries.length > 1) {
      user = userAllEntries[0];
      await User.deleteMany({
        _id: { $ne: user._id },
        email,
        accountVerified: false,
      });
    } else {
      user = userAllEntries[0];
    }

    if (user.verificationCode !== Number(otp)) {
      return next(new ErrorHandler("Invalid otp", 400));
    }

    const currentTime = Date.now();

    const verificationCodeExpire = new Date(
      user.verificationCodeExpire
    ).getTime();

    if (currentTime > verificationCodeExpire) {
      return next(new ErrorHandler("OTP expired", 400));
    }

    user.accountVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpire = null;

    await user.save({ validateModifiedOnly: true });

    sendToken(user, 200, "Account verified", res);
  } catch (error) {
    return next(new ErrorHandler("Internal server error", 500));
  }
});

export const login = catchAsyncErrors(async (req, res, next) => {
  const { email, password } = req.body;
  console.log("Login request received:", email);
  if (!email || !password) {
    console.log("Missing email or password");
    return next(new ErrorHandler("please enter all fields.", 400));
  }
  const user = await User.findOne({ email, accountVerified: true }).select(
    "+password"
  );
  console.log("User fetched from DB:", user);
  if (!user) {
    console.log("No user found or not verified");
    return next(new ErrorHandler("Invalid email or password", 400));
  }
  const isPasswordMatched = await bcrypt.compare(password, user.password);
  console.log("Password match result:", isPasswordMatched);
  if (!isPasswordMatched) {
    console.log("Password did not match");
    return next(new ErrorHandler("Invalid email or password", 400));
  }
  console.log("Sending token...");
  sendToken(user, 200, "user login successfully.", res);
  console.log("Token sent successfully");
});

export const logout = catchAsyncErrors(async (req, res, next) => {
  res
    .status(200)
    .cookie("token", "", {
      expires: new Date(Date.now()),
      httpOnly: true,
    })
    .json({
      success: true,
      message: "Logged out successfully",
    });
});

export const getUser = catchAsyncErrors(async (req, res, next) => {
  const user = req.user;
  res.status(200).json({
    success: true,
    user,
  });
});

export const forgotPassword = catchAsyncErrors(async (req, res, next) => {
  if (!req.body.email) {
    return next(new ErrorHandler("email is required.", 400));
  }
  const user = await User.findOne({
    email: req.body.email,
    accountVerified: true,
  });
  if (!user) {
    return next(new ErrorHandler("Invalid email", 400));
  }

  const resetToken = user.getResetPasswordToken();

  await user.save({ validateBeforeSave: false });
  const resetPasswordUrl = `${process.env.FRONTEND_URL}/password/reset/${resetToken}`;

  const message = generateForgotPasswordEmailTemplate(resetPasswordUrl);

  try {
    await sendEmail({
      email: user.email,
      subject: "Bookworm Library Management System Password Recovery",
      message,
    });
    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email} successfully`,
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new ErrorHandler(error.message, 500));
  }
});

export const resetPassword = catchAsyncErrors(async (req, res, next) => {
  const { token } = req.params;
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });
  if (!user) {
    return next(
      new ErrorHandler(
        "Reset Password token is invalid or has been expired.",
        400
      )
    );
  }
  if (req.body.password !== req.body.confirmPassword) {
    return next(
      new ErrorHandler("password & confirm password do not match", 400)
    );
  }
  if (
    req.body.password.length < 8 ||
    req.body.password.length > 16 ||
    req.body.confirmPassword.length < 8 ||
    req.body.confirmPassword.length > 16
  ) {
    return next(
      new ErrorHandler("password must be between 8 and 16 charecters", 400)
    );
  }
  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  user.password = hashedPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();
  sendToken(user, 200, "password reset successfully", res);
});

export const updatePassword = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user._id).select("+password");
  // console.log(user);
  const { currentPassword, newPassword, confirmNewPassword } = req.body;
  if (!currentPassword || !newPassword || !confirmNewPassword) {
    return next(new ErrorHandler("please enter all fields", 400));
  }

  const isPasswordMatched = await bcrypt.compare(
    currentPassword,
    user.password
  );
  if (!isPasswordMatched) {
    // console.log(user.password);
    return next(new ErrorHandler("current password is incorrect", 400));
  }
  if (
    newPassword.length < 8 ||
    newPassword.length > 16 ||
    confirmNewPassword.length < 8 ||
    confirmNewPassword.length > 16
  ) {
    return next(
      new ErrorHandler("password must be between 8 and 16 charracters", 400)
    );
  }
  if(newPassword !== confirmNewPassword){
    return next(new ErrorHandler("new password and confirm new password ddo not match" , 400));
  }
  const hashedPassword = await bcrypt.hash(newPassword , 10);
  user.password = hashedPassword;
  await user.save();
  res.status(200).json({
    success: true,
    message: "Password updated",
  })
});
