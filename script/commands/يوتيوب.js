const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const baseApiUrl = async () => {
    try {
        const base = await axios.get("https://raw.githubusercontent.com/mahmudx7/HINATA/main/baseApiUrl.json");
        return base.data.mahmud;
    } catch (e) {
        console.error("خطأ في جلب base API URL:", e);
        return "https://api.mahmud.repl.co"; 
    }
};

module.exports.config = {
    title: "يوتيوب",
    release: "1.7",
    clearance: 0,
    author: "Hakim Tracks",
    summary: "بحث وتحميل فيديوهات YouTube",
    section: "عـــامـة",
    syntax: "youtube <كلمة البحث>",
    delay: 5,
};

module.exports.HakimRun = async function ({ api, event, args }) {
    const keyword = args.join(" ");
    if (!keyword) {
        return api.sendMessage(
            "عزيزي، ما الذي تريد البحث عنه في يوتيوب؟ 🔍\nمثال: youtube naruto",
            event.threadID,
            event.messageID
        );
    }

    const cacheDir = path.join(__dirname, "cache");
    await fs.ensureDir(cacheDir);
    const videoPath = path.join(cacheDir, `youtube_${Date.now()}.mp4`);

    try {
        
        if (api.setMessageReaction) {
            api.setMessageReaction("⌛", event.messageID, () => {}, true);
        }

        const apiUrl = await baseApiUrl();
        const response = await axios({
            method: "GET",
            url: `${apiUrl}/api/ytdl`, // أو endpoint اليوتيوب المتوفر
            params: { 
                search: keyword,
                quality: "highest" // أو "720p", "480p" حسب الحاجة
            },
            responseType: "stream",
        });

        const writer = fs.createWriteStream(videoPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        // تم إزالة حد 25 ميجابايت - الآن بدون حدود
        
        await api.sendMessage(
            {
                body: `📺 نتيجة البحث: ${keyword}\n🎥 تم التحميل بنجاح`,
                attachment: fs.createReadStream(videoPath),
            },
            event.threadID,
            () => {
                // حذف الملف بعد الإرسال
                fs.unlink(videoPath, (err) => {
                    if (err) console.error("خطأ في حذف الملف:", err);
                });
                if (api.setMessageReaction) {
                    api.setMessageReaction("✅", event.messageID, () => {}, true);
                }
            }
        );
    } catch (error) {
        console.error("YouTube Error:", error);
        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        if (api.setMessageReaction) {
            api.setMessageReaction("❌", event.messageID, () => {}, true);
        }
        api.sendMessage(
            `حدث خطأ أثناء البحث في يوتيوب: ${error.message}`,
            event.threadID,
            event.messageID
        );
    }
};