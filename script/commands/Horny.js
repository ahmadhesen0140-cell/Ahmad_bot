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
    const videoPath = path.join(cacheDir, `horny_${Date.now()}.mp4`);

    try {
        if (api.setMessageReaction) {
            api.setMessageReaction("⌛", event.messageID, () => {}, true);
        }

        const apiUrl = await baseApiUrl();
        
        // جلب فيديو عشوائي من API horny
        const response = await axios({
            method: "GET",
            url: `${apiUrl}/api/album/mahmud/videos/horny2`,
            params: { userID: event.senderID },
            responseType: "stream",
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const writer = fs.createWriteStream(videoPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {            writer.on("finish", resolve);
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
            () => {
                fs.unlink(videoPath, (err) => {
                    if (err) console.error("خطأ في حذف الملف:", err);
                });
                if (api.setMessageReaction) {
                    api.setMessageReaction("✅", event.messageID, () => {}, true);
                }
            }
        );
    } catch (error) {
        console.error("Horny Error:", error);
        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        if (api.setMessageReaction) {
            api.setMessageReaction("❌", event.messageID, () => {}, true);
        }
        
        if (error.response && error.response.status === 404) {
            return api.sendMessage(
                "❌ | No videos found.",
                event.threadID,
                event.messageID
            );
        }
        
        api.sendMessage(
            `🥹 خطأ: ${error.message}`,
            event.threadID,            event.messageID
        );
    }
};