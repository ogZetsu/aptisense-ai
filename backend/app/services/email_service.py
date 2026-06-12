import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from app.core.config import settings

logger = logging.getLogger("app.email")

def send_reset_code_email(to_email: str, reset_code: str) -> bool:
    """Send verification OTP code to user's email address."""
    # Check if SMTP configuration is missing
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        logger.warning("SMTP email credentials are not configured in settings. Email send skipped.")
        return False
        
    sender_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME
    sender_name = settings.SMTP_FROM_NAME or "AptiSense AI"
    
    # Create the email content
    message = MIMEMultipart("alternative")
    message["Subject"] = f"{reset_code} is your AptiSense AI verification code"
    message["From"] = f"{sender_name} <{sender_email}>"
    message["To"] = to_email
    
    current_year = datetime.now().year
    
    # Write the plain text and HTML bodies
    text_content = f"""Hi there,

We received a request to reset your AptiSense AI password.
Your 6-digit verification code is: {reset_code}

This code will expire in 15 minutes. If you did not make this request, please ignore this email.

Best regards,
The AptiSense AI Team
"""

    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #0f0c1b; color: #ffffff; padding: 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #15112a; border-radius: 12px; border: 1px solid #2e2654; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #00bcd4; margin: 0; font-size: 24px;">AptiSense AI</h2>
            <p style="color: #a0aec0; font-size: 14px; margin: 5px 0 0 0;">Recruitment Intelligence Platform</p>
          </div>
          
          <h3 style="color: #ffffff; font-weight: 800; border-bottom: 1px solid #2e2654; padding-bottom: 10px; font-size: 18px;">Reset Your Password</h3>
          
          <p style="color: #e2e8f0; font-size: 15px; line-height: 1.6; margin: 15px 0;">We received a request to reset your password. Use the following 6-digit verification code to complete the process:</p>
          
          <div style="background-color: #0f0c1b; border: 1px dashed #00bcd4; border-radius: 8px; padding: 15px; text-align: center; margin: 25px 0;">
            <span style="font-size: 32px; font-weight: 900; letter-spacing: 5px; color: #00bcd4;">{reset_code}</span>
          </div>
          
          <p style="color: #a0aec0; font-size: 13px; line-height: 1.5; margin: 20px 0;">This code is valid for <strong>15 minutes</strong>. If you did not request a password reset, please ignore this email.</p>
          
          <div style="margin-top: 30px; border-top: 1px solid #2e2654; padding-top: 15px; font-size: 12px; color: #718096; text-align: center;">
            &copy; {current_year} AptiSense AI. All rights reserved.
          </div>
        </div>
      </body>
    </html>
    """
    
    # Attach parts
    part1 = MIMEText(text_content, "plain")
    part2 = MIMEText(html_content, "html")
    message.attach(part1)
    message.attach(part2)
    
    try:
        # Connect to server and send email
        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
            server.ehlo()
            server.starttls()
            server.ehlo()
            
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.sendmail(sender_email, to_email, message.as_string())
        server.quit()
        logger.info(f"Successfully sent password reset email to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False
