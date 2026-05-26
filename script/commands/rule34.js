const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

// ✅ تم إضافة معلومات الـ API الخاصة بك
const API_CONFIG = {
    user_id: '6295350',
    api_key: '1f1456c603d702d879a2c127b35bdc94d6602950a4ec49f0f6a4524b45004a572c93ccc94e53425fda1df9708520038ce4aacf06ca7f6a2dbfbed914b061a05d'
};

module.exports.config = {
    title: "rule34",
    release: "2.0",
    clearance: 18,
    author: "Hakim Tracks",
    summary: "بحث وتحميل فيديوهات من Rule34",
    section: "عـــامـة",
    syntax: "rule34 <كلمة البحث>",
    delay: 5,
};

module.exports.HakimRun = async function ({ api, event, args }) {
    const keyword = args.join(" ");
    if (!keyword) {
        return api.sendMessage(
            "عزيزي، ما الذي تريد البحث عنه؟ 🔍\nمثال: rule34 naruto",
            event.threadID,
            event.messageID
        );
    }

    const cacheDir = path.join(__dirname, "cache");
    await fs.ensureDir(cacheDir);

    try {
        if (api.setMessageReaction) {
            api.setMessageReaction("⌛", event.messageID, () => {}, true);
        }

        // 📱 iPhone Safari User-Agent
        const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

        // جلب الفيديوهات من Rule34 API
        const apiUrl = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(keyword + " video")}&limit=100`;
        
        const response = await axios.get(apiUrl, {
            headers: { 
                'User-Agent': userAgent  // 📱 iPhone Safari
            },
            params: {                user_id: API_CONFIG.user_id,   // ✅ ID الخاص بك
                api_key: API_CONFIG.api_key    // ✅ Key الخاص بك
            }
        });

        const posts = response.data;

        if (!posts || posts.length === 0) {
            if (api.setMessageReaction) {
                api.setMessageReaction("❌", event.messageID, () => {}, true);
            }
            return api.sendMessage(
                "لم يتم العثور على فيديوهات. جرب كلمة بحث أخرى!",
                event.threadID,
                event.messageID
            );
        }

        // تصفية الفيديوهات فقط
        const videoPosts = posts.filter(post => {
            const fileExt = post.file_ext ? post.file_ext.toLowerCase() : '';
            return (fileExt === 'mp4' || fileExt === 'webm') && post.file_url;
        });

        if (videoPosts.length === 0) {
            if (api.setMessageReaction) {
                api.setMessageReaction("❌", event.messageID, () => {}, true);
            }
            return api.sendMessage(
                "لم يتم العثور على فيديوهات متاحة!",
                event.threadID,
                event.messageID
            );
        }

        // اختيار فيديو عشوائي
        const randomPost = videoPosts[Math.floor(Math.random() * videoPosts.length)];
        const videoUrl = randomPost.file_url;
        const videoExt = randomPost.file_ext || 'mp4';
        const videoPath = path.join(cacheDir, `r34_${Date.now()}.${videoExt}`);

        // تنزيل الفيديو مع iPhone Safari User-Agent 📱
        const videoResponse = await axios({
            method: "GET",
            url: videoUrl,
            responseType: "stream",
            headers: { 'User-Agent': userAgent },
            timeout: 30000
        });
        const writer = fs.createWriteStream(videoPath);
        videoResponse.data.pipe(writer);

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
                "الفيديو كبير جداً (أكثر من 25 ميجابايت). جرب كلمة بحث أخرى!",
                event.threadID,
                event.messageID
            );
        }

        await api.sendMessage(
            {
                body: `• Rule34 Video\n🔞 ${keyword}`,
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
        console.error("Rule34 Error:", error);
        if (api.setMessageReaction) {
            api.setMessageReaction("❌", event.messageID, () => {}, true);
        }
        
        if (error.response && error.response.status === 401) {
            return api.sendMessage(
                "❌ API Key غير صحيح أو منتهي الصلاحية!",
                event.threadID,
                event.messageID
            );
        }        
        api.sendMessage(
            `حدث خطأ: ${error.message}`,
            event.threadID,
            event.messageID
        );
    }
};