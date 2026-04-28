const path = require('path');
const { Resend } = require('resend');

// 1. Пытаемся получить ключ из окружения.
let apiKey = process.env.RESEND_API_KEY;

// 2. Если ключа нет, возможно dotenv не загрузился в app.js или путь другой.
// Попробуем загрузить .env сами, считая что мы в /backend/services/
if (!apiKey) {
    try {
        require('dotenv').config();
        apiKey = process.env.RESEND_API_KEY;
    } catch (e) {
        // ignore
    }
}

// 3. Инициализация клиента. 
// Критично: нельзя передавать undefined/null/empty строку в new Resend(), иначе краш.
let resend;

if (apiKey) {
    resend = new Resend(apiKey);
} else {
    console.warn('⚠️ WARNING: RESEND_API_KEY is missing in .env! Email sending disabled.');
    // Заглушка, чтобы код не падал при неверной конфигурации
    resend = {
        emails: {
            send: async () => {
                console.error('❌ Cannot send email: RESEND_API_KEY is not configured.');
                return { error: 'Configuration Error: Missing API Key' };
            }
        }
    };
}




// ВАЖНО: Resend требует подтвержденный домен для отправки с произвольного адреса.
// Если домен не подтвержден, можно отправлять только с 'onboarding@resend.dev' на свою же почту (для тестов).
// Укажите здесь ваш подтвержденный email или 'onboarding@resend.dev'.
// Также можно задать через переменную окружения SMTP_FROM.
const DEFAULT_FROM = 'onboarding@resend.dev'; 

function getSender() {
    return process.env.SMTP_FROM || DEFAULT_FROM;
}

/**
 * Отправка email для верификации
 */
exports.sendVerificationEmail = async (to, code) => {
  try {
    const siteName = process.env.SITE_NAME || 'Photarea';
    // URL для верификации
    const verifyUrl = process.env.SITE_URL 
        ? `${process.env.SITE_URL.replace(/\/$/, '')}/html/verify.html?email=${encodeURIComponent(to)}` 
        : `http://localhost:3000/html/verify.html?email=${encodeURIComponent(to)}`;

    const { data, error } = await resend.emails.send({
      from: getSender(),
      to: [to],
      subject: `${siteName}: подтвердите почту`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;color:#0b1220;line-height:1.4">
          <h2 style="margin:0 0 8px 0">Подтвердите почту для ${siteName}</h2>
          <p style="margin:0 0 12px 0">Спасибо за регистрацию. Используйте код ниже для подтверждения:</p>
          <p style="font-size:20px;font-weight:700;background:#f6f9fb;padding:12px;border-radius:6px;display:inline-block">${code}</p>
          <p style="margin:16px 0 0 0">Или нажмите на кнопку ниже:</p>
          <p style="margin:10px 0">
            <a href="${verifyUrl}" style="display:inline-block;padding:10px 18px;background:#0b79d0;color:#fff;border-radius:6px;text-decoration:none">Подтвердить почту</a>
          </p>
          <hr style="margin:18px 0;border:none;border-top:1px solid #e6e9ee" />
          <p style="font-size:12px;color:#6b8797;margin:0">Если вы не регистрировались — просто проигнорируйте это письмо.</p>
        </div>
      `
    });

    if (error) {
      console.error('Resend Verification Error:', error);
      return null;
    }
    return data;
  } catch (e) {
    console.error('Mail service error:', e);
    return null;
  }
};

/**
 * Универсальная отправка
 */
exports.sendEmail = async (to, subject, text, html) => {
    try {
        if(!to) return;
        const { data, error } = await resend.emails.send({
            from: getSender(),
            to: [to],
            subject: subject,
            text: text,
            html: html || (`<p>${text}</p>`)
        });
        if (error) {
            console.error('Resend Generic Error:', error);
        }
        return data;
    } catch(e) {
        console.error('Mail service error:', e);
    }
};

// Для совместимости, если где-то используется старый метод (опционально)
exports.sendChatOrderNotification = async (userEmail, userId, message) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    if(!adminEmail) return;
    return exports.sendEmail(
        adminEmail,
        `New Order Request (User #${userId})`,
        `New chat request from user ${userId} (${userEmail || 'No email'}).\n\nInitial Message: ${message || 'File uploaded'}`,
        `<p>New chat request from user <b>${userId}</b> (${userEmail || 'No email'}).</p><p>Message: ${message}</p>`
    );
};
