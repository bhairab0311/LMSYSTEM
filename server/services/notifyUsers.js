import corn from "node-cron";
import { Borrow } from "../models/borrowModel.js";
import { User } from "../models/userModel.js";
import { sendEmail } from "../utils/sendEmail.js";

export const notifyUsers = () => {
  corn.schedule("*/30 * * * * *", async () => {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const borrowers = await Borrow.find({
        dueDate: {
          $lt: oneDayAgo,
        },
        returnDate: null,
        notified: false,
      });

      for (const element of borrowers) {
        if (element.user && element.user.email) {
          sendEmail({
            email: element.user.email,
            subject: "Book Return Reminder",
            message: `Hello ${element.user.name},\n\nThis is a reminder taht the book you borrowed is due for return today.return the book to the library as soon as possible\n\n.Thank you`,
          });
          element.notified = true;
          await element.save();
          console.log(`email sent to ${element.user.email}`)
        }
      }
    } catch (error) {
        console.log("some error occured while notifying user.", error)
    }
  });
};
