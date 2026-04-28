require('dotenv').config();
const { Telegraf, session, Markup } = require('telegraf');
const { initBotDatabase, db } = require('./database');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

if (!process.env.BOT_TOKEN) {
  console.error('❌ Ошибка: BOT_TOKEN не найден в .env файле');
  process.exit(1);
}

initBotDatabase();

const bot = new Telegraf(process.env.BOT_TOKEN);

const WELCOME_IMAGE = 'https://i.imgur.com/7RJZqS9.png';
const MENU_IMAGES_DIR = path.resolve(__dirname, 'menu-images');
const MENU_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const TG_LINK_SECRET = process.env.TG_LINK_SECRET || process.env.BOT_TOKEN || 'change-me';
const SITE_BASE_URL = process.env.SITE_URL || 'http://localhost:3000';

function getMenuImagePath() {
  try {
    if (!fs.existsSync(MENU_IMAGES_DIR)) return null;
    const files = fs.readdirSync(MENU_IMAGES_DIR)
      .filter(f => MENU_IMAGE_EXTS.has(path.extname(f).toLowerCase()));
    if (!files.length) return null;
    const pick = files[Math.floor(Math.random() * files.length)];
    return path.join(MENU_IMAGES_DIR, pick);
  } catch (e) {
    return null;
  }
}

async function removeReplyKeyboard(ctx) {
  try {
    const msg = await ctx.reply(' ', Markup.removeKeyboard());
    if (msg?.message_id) {
      await ctx.deleteMessage(msg.message_id).catch(() => {});
    }
  } catch (e) {
    // ignore
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createLinkHash(telegramId, siteUserId) {
  return crypto.createHmac('sha256', TG_LINK_SECRET)
    .update(`${telegramId}:${siteUserId}`)
    .digest('hex');
}

function isAdmin(ctx) {
  const adminId = process.env.ADMIN_ID;
  if (!adminId || !ctx?.from?.id) return false;
  return ctx.from.id.toString() === adminId;
}

function mainMenu(ctx) {
  const rows = [
    [
      Markup.button.callback('🧾 Заказы', 'main_orders'),
      Markup.button.callback('👤 Кабинет', 'main_cabinet')
    ],
    [Markup.button.callback('ℹ️ О НАС', 'main_about')]
  ];

  if (isAdmin(ctx)) {
    rows.push([Markup.button.callback('⚙️ Админ-панель', 'main_admin')]);
  }

  return Markup.inlineKeyboard(rows);
}

function backToMainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🏠 Назад', 'back_main')]
  ]);
}

function ordersKeyboard(orders) {
  const rows = [];
  for (let i = 0; i < orders.length; i += 2) {
    const left = orders[i];
    const right = orders[i + 1];
    const row = [Markup.button.callback(`№${left.order_number}`, `order_${left.id}`)];
    if (right) row.push(Markup.button.callback(`№${right.order_number}`, `order_${right.id}`));
    rows.push(row);
  }

  rows.push([
    Markup.button.callback('🔄 Обновить', 'main_orders'),
    Markup.button.callback('🏠 Назад', 'back_main')
  ]);
  return Markup.inlineKeyboard(rows);
}

function cabinetKeyboard(isLinked) {
  if (!isLinked) {
    return Markup.inlineKeyboard([
      [Markup.button.url('🔗 Связать аккаунт', `${SITE_BASE_URL}/html/login.html`)],
      [Markup.button.callback('✅ Проверить связь', 'cabinet_check_link')],
      [Markup.button.callback('🏠 Назад', 'back_main')]
    ]);
  }

  return Markup.inlineKeyboard([
    [Markup.button.callback('🧾 Мои заказы', 'main_orders')],
    [Markup.button.callback('🔄 Обновить', 'main_cabinet')],
    [Markup.button.callback('🏠 Назад', 'back_main')]
  ]);
}

function adminKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Обновить', 'main_admin')],
    [Markup.button.callback('🏠 Назад', 'back_main')]
  ]);
}

async function sendMenuMessage(ctx, caption, keyboard) {
  const localImagePath = getMenuImagePath();
  if (localImagePath) {
    await ctx.replyWithPhoto({ source: localImagePath }, { caption, parse_mode: 'HTML', ...keyboard });
    return;
  }
  await ctx.replyWithPhoto(WELCOME_IMAGE, { caption, parse_mode: 'HTML', ...keyboard });
}

async function editOrSend(ctx, caption, keyboard, { forceNew = false } = {}) {
  if (ctx.callbackQuery?.message && !forceNew) {
    try {
      await ctx.editMessageCaption(caption, { parse_mode: 'HTML', ...keyboard });
      return;
    } catch (e) {
      // fallback to new message
    }
  }

  await sendMenuMessage(ctx, caption, keyboard);
}

async function tryLinkFromStartPayload(ctx, rawToken) {
  try {
    await db.promise.refreshSiteCache();
    const tokenHash = hashToken(rawToken);
    const siteUser = await db.promise.getSiteUserByLinkTokenHash(tokenHash);
    if (!siteUser) return false;
    if (siteUser.tg_link_token_expires && Number(siteUser.tg_link_token_expires) < Date.now()) return false;

    const linkHash = createLinkHash(ctx.from.id, siteUser.id);
    await db.promise.finalizeSiteLink(siteUser.id, linkHash);
    await db.promise.linkSiteUser(ctx.from.id, siteUser.id, linkHash);
    return true;
  } catch (e) {
    console.error('Ошибка привязки:', e);
    return false;
  }
}

bot.use(session());

bot.use(async (ctx, next) => {
  if (!ctx.session) ctx.session = {};
  if (ctx.from) {
    try {
      await db.promise.saveUser(ctx.from);
    } catch (err) {
      console.error('Ошибка сохранения пользователя:', err);
    }
  }
  return next();
});

bot.start(async (ctx) => {
  ctx.session = ctx.session || {};

  await removeReplyKeyboard(ctx);

  if (ctx.startPayload && String(ctx.startPayload).startsWith('link_')) {
    const rawToken = String(ctx.startPayload).slice(5);
    const linked = await tryLinkFromStartPayload(ctx, rawToken);
    if (linked) {
      await showCabinet(ctx, '✅ Аккаунты успешно связаны');
      return;
    }
  }

  const userName = ctx.from.first_name || 'пользователь';
  const caption =
    `<b>WELCOME</b>\n\n` +
    `📍 Добро пожаловать в главное меню!\n\n` +
    `Привет, ${userName}! Выберите нужный раздел:`;

  await editOrSend(ctx, caption, mainMenu(ctx), { forceNew: true });

  try {
    await db.promise.saveMessage(ctx.from.id, ctx.message.message_id, ctx.chat.id, '/start', 'command', false);
  } catch (err) {
    console.error('Ошибка сохранения:', err);
  }
});

async function showCabinet(ctx, prefixMessage = '') {
  await db.promise.refreshSiteCache().catch(() => {});
  const user = await db.promise.getUser(ctx.from.id);
  let siteUser = null;

  if (user?.site_user_id) {
    siteUser = await db.promise.getSiteUserById(user.site_user_id).catch(() => null);
  }

  const lines = [];
  if (prefixMessage) lines.push(prefixMessage);

  lines.push('<b>👤 Личный кабинет</b>');
  lines.push('');
  lines.push(`🆔 Telegram ID: <code>${ctx.from.id}</code>`);
  lines.push(`👤 Имя: ${ctx.from.first_name || 'Не указано'}`);
  lines.push(`📧 Username: ${ctx.from.username ? '@' + ctx.from.username : 'Не указан'}`);

  if (siteUser) {
    lines.push('');
    lines.push('<b>Связанный аккаунт сайта:</b>');
    lines.push(`ID: <code>${siteUser.id}</code>`);
    if (siteUser.login) lines.push(`Логин: ${siteUser.login}`);
    if (siteUser.email) lines.push(`Email: ${siteUser.email}`);
  } else {
    lines.push('');
    lines.push('⚠️ Аккаунт сайта не связан.');
  }

  await editOrSend(ctx, lines.join('\n'), cabinetKeyboard(!!siteUser));
}

async function showOrders(ctx) {
  await db.promise.refreshSiteCache().catch(() => {});
  const user = await db.promise.getUser(ctx.from.id);

  if (!user?.site_user_id) {
    const caption =
      `<b>🧾 Заказы</b>\n\n` +
      `Сначала свяжите аккаунт на сайте, чтобы видеть историю заказов.`;
    await editOrSend(ctx, caption, cabinetKeyboard(false));
    return;
  }

  const orders = await db.promise.getSiteOrders(user.site_user_id).catch(() => []);
  if (!orders?.length) {
    const caption =
      `<b>🧾 Заказы</b>\n\n` +
      `У вас пока нет заказов.`;
    await editOrSend(ctx, caption, backToMainKeyboard());
    return;
  }

  const caption =
    `<b>🧾 История заказов</b>\n\n` +
    `Выберите заказ для просмотра:`;
  await editOrSend(ctx, caption, ordersKeyboard(orders.slice(0, 10)));
}

async function showOrderDetails(ctx, orderId) {
  await db.promise.refreshSiteCache().catch(() => {});
  const order = await db.promise.getSiteOrderById(orderId).catch(() => null);

  if (!order) {
    await editOrSend(ctx, '❌ Заказ не найден', backToMainKeyboard());
    return;
  }

  const date = new Date(order.order_date).toLocaleDateString('ru-RU');
  const caption =
    `<b>📦 Заказ №${order.order_number}</b>\n\n` +
    `💰 Сумма: ${order.total_amount} руб.\n` +
    `📊 Статус: ${order.status}\n` +
    `💳 Оплата: ${order.payment}\n` +
    `📅 Дата: ${date}\n` +
    (order.pages_count ? `📄 Страниц: ${order.pages_count}\n` : '') +
    (order.admin_comment ? `📝 Комментарий: ${order.admin_comment}\n` : '');

  await editOrSend(ctx, caption, Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ К списку', 'main_orders')],
    [Markup.button.callback('🏠 Назад', 'back_main')]
  ]));
}

async function showAbout(ctx) {
  const caption =
    `<b>ℹ️ О НАС</b>\n\n` +
    `Мы — современная компания.\n` +
    `Контакты: support@example.com\n` +
    `Сайт: example.com\n\n` +
    `Будем рады помочь!`;
  await editOrSend(ctx, caption, backToMainKeyboard());
}

async function showAdmin(ctx) {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('❌ У вас нет доступа', { show_alert: true });
    return;
  }

  const stats = await db.promise.getStats().catch(() => null);
  if (!stats) {
    await editOrSend(ctx, '❌ Ошибка загрузки статистики', adminKeyboard());
    return;
  }

  const caption =
    `<b>⚙️ Админ-панель</b>\n\n` +
    `👥 Всего пользователей: <b>${stats.total_users}</b>\n` +
    `✅ Активных: <b>${stats.active_users}</b>\n` +
    `💬 Сообщений: <b>${stats.total_messages}</b>\n` +
    `📎 Файлов: <b>${stats.total_files}</b>\n` +
    `📦 Заказов (кэш): <b>${stats.cached_orders}</b>\n` +
    `🧾 Заказов (сайт): <b>${stats.site_orders}</b>`;

  await editOrSend(ctx, caption, adminKeyboard());
}

bot.action('main_orders', async (ctx) => {
  await ctx.answerCbQuery();
  await showOrders(ctx);
});

bot.action('main_cabinet', async (ctx) => {
  await ctx.answerCbQuery();
  await showCabinet(ctx);
});

bot.action('main_about', async (ctx) => {
  await ctx.answerCbQuery();
  await showAbout(ctx);
});

bot.action('main_admin', async (ctx) => {
  await ctx.answerCbQuery();
  await showAdmin(ctx);
});

bot.action('cabinet_check_link', async (ctx) => {
  await ctx.answerCbQuery('🔄 Проверяю связь...');
  await showCabinet(ctx);
});

bot.action('back_main', async (ctx) => {
  await ctx.answerCbQuery();
  const userName = ctx.from.first_name || 'пользователь';
  const caption =
    `<b>WELCOME</b>\n\n` +
    `📍 Добро пожаловать в главное меню!\n\n` +
    `Привет, ${userName}! Выберите нужный раздел:`;
  await editOrSend(ctx, caption, mainMenu(ctx));
});

bot.action(/^order_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const orderId = Number(ctx.match[1]);
  await showOrderDetails(ctx, orderId);
});

bot.on('text', async (ctx) => {
  const text = (ctx.message.text || '').trim();

  if (['Кабинет', '👤 Кабинет'].includes(text)) {
    await showCabinet(ctx);
    return;
  }

  if (['Заказы', '🧾 Заказы', 'Мои заказы'].includes(text)) {
    await showOrders(ctx);
    return;
  }

  if (['О НАС', 'ℹ️ О НАС', 'О нас'].includes(text)) {
    await showAbout(ctx);
    return;
  }

  if (['Админ-меню', 'Админ-панель', '⚙️ Админ-панель'].includes(text)) {
    await showAdmin(ctx);
    return;
  }

  try {
    await db.promise.saveMessage(ctx.from.id, ctx.message.message_id, ctx.chat.id, text, 'text', false);
  } catch (err) {
    console.error('Ошибка сохранения сообщения:', err);
  }
  await ctx.reply('ℹ️ Используйте команду /start для открытия главного меню');
});

bot.catch((err, ctx) => {
  console.error(`❌ Ошибка для ${ctx.updateType}:`, err);
});

bot.launch()
  .then(() => {
    console.log('✅ Бот успешно запущен!');
    console.log(`⏰ Время запуска: ${new Date().toLocaleString('ru-RU')}`);
  })
  .catch((err) => {
    console.error('❌ Ошибка запуска бота:', err);
    process.exit(1);
  });

process.once('SIGINT', () => {
  console.log('\n⚠️ Останавливаю бота...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('\n⚠️ Останавливаю бота...');
  bot.stop('SIGTERM');
});
