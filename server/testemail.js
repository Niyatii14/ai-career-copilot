
require("dotenv").config();

const sendEmail = require("./utils/sendEmail");

async function testEmail() {
  try {
    await sendEmail({
      to: process.env.EMAIL_USER,
      subject: "AI Career Copilot - Email Test",
      text: "Success! Your email service is working.",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>AI Career Copilot</h2>
          <p>Success! Your email service is working.</p>
          <p>You're ready to set up email verification.</p>
        </div>
      `,
    });

    console.log("Test email sent successfully!");
  } catch (error) {
    console.error("Email test failed:", error.message);
  }
}

testEmail();
