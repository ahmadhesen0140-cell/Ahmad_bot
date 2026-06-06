const activeLoops = new Map();

module.exports = {
  config: {
    name: "loopReply",
    version: "2.0",
    hasPermission: 2, // 0: عام | 1: أدمن مجموعة | 2: أدمن بوت
    description: "إضافة/إزالة دوري بالرد على رسالة الشخص",
    commandCategory: "admin",
    usePrefix: true
  },

  run: async ({ api, event, args }) => {
    const { threadID, type, messageReply } = event;
    const text = args.join(" ").trim().toLowerCase();

    // 🔍 استخراج الـ ID تلقائياً من الرد
    let targetId = (messageReply && messageReply.senderID) ? messageReply.senderID : null;

    // 1️⃣ تشغيل الحلقة (;Y)
    if (text === ";y") {
      if (!targetId) return api.sendMessage("❌ يرجى الرد على رسالة الشخص ثم إرسال `;Y`", threadID);
      if (activeLoops.has(threadID)) return api.sendMessage("⚠️ يوجد حلقة نشطة بالفعل في هذه المجموعة.", threadID);

      const delay = 5000; // فاصل آمن (5 ثوانٍ) لتجنب الحظر
      const intervalId = setInterval(async () => {
        try {
          await new Promise((res, rej) => {
            api.addUserToGroup(targetId, threadID, (err) => err ? rej(err) : res());
          });
          await new Promise((res, rej) => {
            api.removeUserFromGroup(targetId, threadID, (err) => err ? rej(err) : res());
          });
        } catch (err) {
          clearInterval(intervalId);
          activeLoops.delete(threadID);
          api.sendMessage(`⛔ توقف تلقائي بسبب خطأ: ${err.error || err.message || "مشكلة في الاتصال أو الصلاحيات"}`, threadID);
        }
      }, delay);

      activeLoops.set(threadID, { intervalId, targetId });
      return api.sendMessage(`✅ بدء الحلقة للمستخدم <${targetId}> كل 5 ثوانٍ.\nأرسل `;N` للإيقاف.`, threadID);
    }

    // 2️⃣ إيقاف الحلقة (;N)
    if (text === ";n") {
      if (!activeLoops.has(threadID)) return api.sendMessage("🔴 لا توجد حلقة نشطة.", threadID);
      clearInterval(activeLoops.get(threadID).intervalId);
      activeLoops.delete(threadID);
      return api.sendMessage("⛔ تم إيقاف الحلقة بنجاح.", threadID);
    }

    // 3️⃣ إضافة يدوية واحدة (;add)
    if (text === ";add") {
      if (!targetId) return api.sendMessage("❌ رد على الشخص ثم أرسل `;add`", threadID);
      api.addUserToGroup(targetId, threadID, (err) => {
        api.sendMessage(err ? `❌ فشل الإضافة: ${err.error || err.message}` : `✅ تمت إضافة <${targetId}>`, threadID);
      });
      return;
    }

    // 4️⃣ إزالة يدوية واحدة (;remove)
    if (text === ";remove") {
      if (!targetId) return api.sendMessage("❌ رد على الشخص ثم أرسل `;remove`", threadID);
      api.removeUserFromGroup(targetId, threadID, (err) => {
        api.sendMessage(err ? `❌ فشل الإزالة: ${err.error || err.message}` : `✅ تمت إزالة <${targetId}>`, threadID);
      });
      return;
    }

    // 📋 مساعدة
    api.sendMessage(
      `📋 طريقة الاستخدام:\n` +
      `1. اضغط مطولاً على رسالة الشخص → اختر "رد"\n` +
      `2. اكتب أحد الأوامر:\n` +
      `• \` ;Y \` : تشغيل إضافة/إزالة دورية\n` +
      `• \` ;N \` : إيقاف الحلقة\n` +
      `• \` ;add \` : إضافة لمرة واحدة\n` +
      `• \` ;remove \` : إزالة لمرة واحدة`,
      threadID
    );
  }
};