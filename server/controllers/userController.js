import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import { User } from "../models/userModel.js";
import bcrypt from "bcrypt";
import { v2 as cloudinary } from "cloudinary";

export const getAllUser = catchAsyncErrors(async (req, res, next) => {
  const users = await User.find({ accountVerified: true });
  res.status(200).json({
    success: true,
    users,
  });
});

export const registerNewAdmin = catchAsyncErrors(async (req, res, next) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return next(new ErrorHandler("Admin avater is required", 400));
  }
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return next(new ErrorHandler("please fill all fields", 400));
  }

  const isRegister = await User.findOne({ email, accountVerified: true });
  if (isRegister) {
    return next(new ErrorHandler("user already registered", 400));
  }
  if ((password.length < 8) | (password.length > 16)) {
    return next(
      new ErrorHandler("password must be between 8 to 16 charecters long", 400)
    );
  }
  const { avatar } = req.files;
  const allowedFormats = ["image/png", "image/jpeg", "image/webp"];
  if (!allowedFormats.includes(avatar.mimetype)) {
    return next(new ErrorHandler("file format not supported", 400));
  }
  const hashedpassword = await bcrypt.hash(password, 10);
  const cloudinaryResponse = await cloudinary.uploader.upload(
    avatar.tempFilePath,
    {
      folder: "LIBRARY_MANAGEMENT_SYSTEM_ADMIN_AVATARS",
    }
  );
  if (!cloudinary || cloudinaryResponse.error) {
    console.error(
      "clodinary error:",
      cloudinaryResponse.error || "unknown cloudinary error"
    );
    return next(
      new ErrorHandler("failed to upload avater image to cloudinary", 500)
    );
  }
  const admin = await User.create({
    name,
    email,
    password: hashedpassword,
    role: "Admin",
    accountVerified: true,
    avatar: {
      public_id: cloudinaryResponse.public_id,
      url: cloudinaryResponse.secure_url
    }
  });
  res.status(201).json({
    success: true,
    Message: "Admin registered successfully",
    admin,
  })
});
