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

// 📱 iPhone Safari User-Agent
const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

module.exports.config = {
    title: "horny",
    release: "1.7",
    clearance: 18,
    author: "Hakim Tracks",
    summary: "جلب فيديو عشوائي من مكتبة horny",
    section: "18+",
    syntax: "horny",
    delay: 5,
};

module.exports.HakimRun = async function ({ api, event, args }) {
    const cacheDir = path.join(__dirname, "cache");
    await fs.ensureDir(cacheDir);

    try {
        if (api.setMessageReaction) {
            api.setMessageReaction("⌛", event.messageID, () => {}, true);
        }

        const apiUrl = await baseApiUrl();
        
        // ⚠️ الطلب الأول: جلب قائمة الفيديوهات (JSON) مع User-Agent 📱
        const response = await axios.get(
            `${apiUrl}/api/album/mahmud/videos/horny2`,
            { 
                params: { userID: event.senderID },
                headers: { 'User-Agent': userAgent }
            }
        );

        if (!response.data.success || !response.data.videos || response.data.videos.length === 0) {
            if (api.setMessageReaction) {                api.setMessageReaction("❌", event.messageID, () => {}, true);
            }
            return api.sendMessage(
                "❌ | No videos found.",
                event.threadID,
                event.messageID
            );
        }

        // اختيار فيديو عشوائي
        const randomVideoUrl = response.data.videos[Math.floor(Math.random() * response.data.videos.length)];
        const videoPath = path.join(cacheDir, `horny_${Date.now()}.mp4`);

        // ⚠️ الطلب الثاني: تنزيل الفيديو الفعلي مع نفس User-Agent 📱
        const videoStream = await axios({
            method: "GET",
            url: randomVideoUrl,
            responseType: "stream",
            headers: { 'User-Agent': userAgent },
            timeout: 30000
        });

        const writer = fs.createWriteStream(videoPath);
        videoStream.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        const stats = fs.statSync(videoPath);
        if (stats.size > 25 * 1024 * 1024) { 
            fs.unlinkSync(videoPath);
            if (api.setMessageReaction) {
                api.setMessageReaction("❌", event.messageID, () => {}, true);
            }
            return api.sendMessage(
                "الفيديو كبير جداً (أكثر من 25 ميجابايت). جرب مرة أخرى!",
                event.threadID,
                event.messageID
            );
        }

        await api.sendMessage(
            {
                body: `𝐇𝐞𝐫𝐞'𝐬 𝐲𝐨𝐮𝐫 𝐇𝐨𝐫𝐧𝐲 𝐯𝐢𝐝𝐞𝐨 <😘\n🔞 18+`,
                attachment: fs.createReadStream(videoPath),
            },
            event.threadID,
            () => {                fs.unlink(videoPath, (err) => {
                    if (err) console.error("خطأ في حذف الملف:", err);
                });
                if (api.setMessageReaction) {
                    api.setMessageReaction("✅", event.messageID, () => {}, true);
                }
            }
        );

    } catch (error) {
        console.error("Horny Error:", error);
        if (api.setMessageReaction) {
            api.setMessageReaction("❌", event.messageID, () => {}, true);
        }
        
        let errorMsg = "🥹 خطأ: ";
        if (error.code === 'ECONNABORTED') {
            errorMsg += "انتهت مهلة الاتصال";
        } else if (error.response?.status === 404) {
            errorMsg += "لا توجد فيديوهات متاحة";
        } else {
            errorMsg += error.message;
        }
        
        api.sendMessage(errorMsg, event.threadID, event.messageID);
    }
};