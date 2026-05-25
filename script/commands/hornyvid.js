const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const mahmud = async () => {
  try {
    const response = await axios.get("https://raw.githubusercontent.com/mahmudx7/HINATA/main/baseApiUrl.json");
    return response.data.mahmud;
  } catch (e) {
    console.error("خطأ في جلب base API URL:", e);
    return "https://api.mahmud.repl.co"; // fallback URL
  }
};

module.exports = {
  config: {
    name: "horny",
    aliases: ["hornyvid", "hvideo"],
    version: "1.7",
    role: 0,
    author: "MahMUD",
    category: "18+",
    guide: {
      en: "Use {pn} to get a random horny video."
    }
  },

  onStart: async function ({ api, event }) {
    const obfuscatedAuthor = String.fromCharCode(77, 97, 104, 77, 85, 68); 
    if (module.exports.config.author !== obfuscatedAuthor) {
      return api.sendMessage("You are not authorized to change the author name.", event.threadID, event.messageID);
    }
    
    try {
      const apiUrl = await mahmud();
      const res = await axios.get(`${apiUrl}/api/album/mahmud/videos/horny2?userID=${event.senderID}`);
      
      if (!res.data?.success || !res.data?.videos?.length) {
        return api.sendMessage("❌ | No videos found.", event.threadID, event.messageID);
      }

      const url = res.data.videos[Math.floor(Math.random() * res.data.videos.length)];
      const filePath = path.join(__dirname, "cache", `horny_${Date.now()}.mp4`);

      // إنشاء مجلد cache إذا لم يكن موجوداً
      await fs.ensureDir(path.join(__dirname, "cache"));

      const video = await axios({
        url,
        method: "GET",
        responseType: "stream",
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const writer = fs.createWriteStream(filePath);
      video.data.pipe(writer);

      // انتظار اكتمال التحميل
      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      // التحقق من حجم الملف (اختياري - حد 25 ميجابايت)
      const stats = fs.statSync(filePath);
      if (stats.size > 25 * 1024 * 1024) {
        await fs.unlink(filePath);
        return api.sendMessage("❌ | Video file too large.", event.threadID, event.messageID);
      }

      api.sendMessage({
        body: "𝐇𝐞𝐫𝐞'𝐬 𝐲𝐨𝐮𝐫 𝐇𝐨𝐫𝐧𝐲 𝐯𝐢𝐝𝐞𝐨 <😘",
        attachment: fs.createReadStream(filePath)
      }, event.threadID, async () => {
        // حذف الملف بعد الإرسال
        try {
          await fs.unlink(filePath);
        } catch (err) {
          console.error("Error deleting file:", err);
        }
      }, event.messageID);

    } catch (e) {
      console.error("ERROR:", e);
      api.sendMessage("🥹 Error, contact MahMUD.", event.threadID, event.messageID);
    }
  }
};
