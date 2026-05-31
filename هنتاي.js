/**
 * Hentai Bot for Messenger
 * Author: Hakim Tracks
 * Description: Search and download content from Rule34.xxx
 */

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

// 🔑 API Configuration - Rule34.xxx
const API_CONFIG = {
    user_id: '6295350',
    api_key: '1f1456c603d702d879a2c127b35bdc94d6602950a4ec49f0f6a4524b45004a572c93ccc94e53425fda1df9708520038ce4aacf06ca7f6a2dbfbed914b061a05d'
};

// 📱 iPhone Safari User-Agent
const USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

module.exports.config = {
    title: "هنتاي",
    release: "3.1",
    clearance: 18,
    author: "Hakim Tracks",
    summary: "بحث وتحميل محتوى هنتاي من Rule34.xxx",
    section: "18+",
    syntax: "هنتاي <كلمة البحث>",
    delay: 5,
};

module.exports.HakimRun = async function ({ api, event, args }) {
    const keyword = args.join(" ").trim();
    
    // التحقق من كلمة البحث
    if (!keyword) {
        return api.sendMessage(
            "🔍 الاستخدام: هنتاي <كلمة البحث>\nمثال: هنتاي naruto",
            event.threadID,
            event.messageID
        );
    }

    const cacheDir = path.join(__dirname, "cache", "هنتاي");
    await fs.ensureDir(cacheDir);

    try {
        // تفاعل الانتظار
        if (api.setMessageReaction) {
            api.setMessageReaction("⌛", event.messageID, () => {}, true);
        }
        // بناء رابط الـ API
        const tags = encodeURIComponent(keyword);
        const apiUrl = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${tags}&limit=50&user_id=${API_CONFIG.user_id}&api_key=${API_CONFIG.api_key}`;

        // الطلب الأول: جلب قائمة المنشورات
        const response = await axios.get(apiUrl, {
            headers: { 
                'User-Agent': USER_AGENT,
                'Accept': 'application/json'
            },
            timeout: 20000
        });

        const posts = response.data;

        // التحقق من النتائج
        if (!Array.isArray(posts) || posts.length === 0) {
            if (api.setMessageReaction) {
                api.setMessageReaction("❌", event.messageID, () => {}, true);
            }
            return api.sendMessage(
                `❌ لم يتم العثور على نتائج لـ "${keyword}"\n💡 جرب كلمات بحث بالإنجليزي`,
                event.threadID,
                event.messageID
            );
        }

        // تصفية الفيديوهات فقط
        const videoPosts = posts.filter(post => {
            const ext = (post.file_ext || "").toLowerCase();
            return (ext === 'mp4' || ext === 'webm') && post.file_url;
        });

        // إذا لم نجد فيديوهات، نجرب الصور
        const contentPosts = videoPosts.length > 0 ? videoPosts : posts.filter(post => {
            const ext = (post.file_ext || "").toLowerCase();
            return (ext === 'jpg' || ext === 'png' || ext === 'jpeg') && post.file_url;
        });

        if (contentPosts.length === 0) {
            if (api.setMessageReaction) {
                api.setMessageReaction("❌", event.messageID, () => {}, true);
            }
            return api.sendMessage(
                "❌ لم يتم العثور على محتوى قابل للتحميل!",
                event.threadID,
                event.messageID
            );
        }
        // اختيار عنصر عشوائي
        const randomPost = contentPosts[Math.floor(Math.random() * contentPosts.length)];
        const fileUrl = randomPost.file_url;
        const fileExt = (randomPost.file_ext || "jpg").toLowerCase();
        const fileName = `هنتاي_${Date.now()}.${fileExt}`;
        const filePath = path.join(cacheDir, fileName);

        // تنزيل الملف
        const fileResponse = await axios({
            method: "GET",
            url: fileUrl,
            responseType: "stream",
            headers: { 'User-Agent': USER_AGENT },
            timeout: 40000,
            maxContentLength: 30 * 1024 * 1024
        });

        const writer = fs.createWriteStream(filePath);
        fileResponse.data.pipe(writer);

        // انتظار انتهاء الكتابة
        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        // التحقق من حجم الملف
        const stats = fs.statSync(filePath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

        if (stats.size > 25 * 1024 * 1024) {
            fs.unlinkSync(filePath);
            if (api.setMessageReaction) {
                api.setMessageReaction("❌", event.messageID, () => {}, true);
            }
            return api.sendMessage(
                `❌ الملف كبير جداً (${sizeInMB} MB)\nالحد الأقصى: 25 MB`,
                event.threadID,
                event.messageID
            );
        }

        // إرسال الملف
        const rating = randomPost.rating ? randomPost.rating.toUpperCase() : "N/A";
        const id = randomPost.id || "N/A";
        
        const caption = `🔞 هنتاي\n📌 ${keyword}\n🆔 ID: ${id}\n⭐ ${rating}\n📦 ${sizeInMB} MB\n\n🔞 18+`;

        await api.sendMessage({            body: caption,
            attachment: fs.createReadStream(filePath)
        }, event.threadID, (err, info) => {
            // حذف الملف بعد الإرسال
            if (fs.existsSync(filePath)) {
                fs.unlink(filePath, (e) => {
                    if (e) console.error("❌ حذف الملف فشل:", e);
                });
            }
            if (api.setMessageReaction) {
                api.setMessageReaction("✅", event.messageID, () => {}, true);
            }
        }, event.messageID);

    } catch (error) {
        console.error("🔴 هنتاي Error:", error);
        
        if (api.setMessageReaction) {
            api.setMessageReaction("❌", event.messageID, () => {}, true);
        }

        let errorMsg = "❌ خطأ: ";
        
        if (error.code === 'ECONNABORTED') {
            errorMsg += "انتهت مهلة الاتصال ⏱️";
        } else if (error.code === 'ECONNREFUSED') {
            errorMsg += "لا يمكن الاتصال بالخادم 🔌";
        } else if (error.response?.status === 403) {
            errorMsg += "API Key غير صالح أو ممنوع 🚫";
        } else if (error.response?.status === 429) {
            errorMsg += "تم تجاوز الحد المسموح، انتظر قليلاً ⏳";
        } else {
            errorMsg += error.message || "خطأ غير معروف";
        }

        api.sendMessage(errorMsg, event.threadID, event.messageID);
    }
};
