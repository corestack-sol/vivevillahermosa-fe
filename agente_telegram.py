import asyncio
import os
from dotenv import load_dotenv
from telegram import Update

load_dotenv(".env.local")
from telegram.ext import ApplicationBuilder, MessageHandler, filters, ContextTypes
from claude_agent_sdk import query, ClaudeAgentOptions

TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]

# Sin esto, cualquier persona que le escriba al bot (los bots de Telegram
# son enumerables, no son secretos) podía ejecutar Bash/Read/Write/Edit
# arbitrarios en esta máquina — hallazgo C4 de la auditoría de seguridad.
# Configura TELEGRAM_ALLOWED_IDS en .env.local con tu(s) user_id de
# Telegram separados por coma (pídeselo a @userinfobot).
_allowed_raw = os.environ.get("TELEGRAM_ALLOWED_IDS", "")
ALLOWED_IDS = {int(x) for x in _allowed_raw.split(",") if x.strip()}
if not ALLOWED_IDS:
    raise RuntimeError(
        "TELEGRAM_ALLOWED_IDS no está configurado — el bot no arrancará sin "
        "una allowlist explícita de user_id autorizados."
    )

async def manejar_mensaje(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user is None or update.effective_user.id not in ALLOWED_IDS:
        return  # ignora silenciosamente a cualquiera no autorizado

    tarea = update.message.text
    await update.message.reply_text("⏳ Trabajando en eso...")

    respuesta = ""
    async for message in query(
        prompt=tarea,
        options=ClaudeAgentOptions(allowed_tools=["Read", "Write", "Edit", "Glob", "Grep", "Bash"]),
    ):
        if hasattr(message, "result"):
            respuesta = message.result

    await update.message.reply_text(respuesta or "No obtuve respuesta.")

app = ApplicationBuilder().token(TOKEN).build()
app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, manejar_mensaje))

print("Bot corriendo... Escríbele a tu bot en Telegram")
app.run_polling()