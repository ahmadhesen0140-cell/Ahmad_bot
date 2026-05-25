const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

// 🔑 API Configuration
const API_CONFIG = {
    // استخدم API r34.app الرسمي أو rule34.xxx المباشر
    baseUrl: "https://api.r34.app", // الـ API الرسمي
    // أو استخدم: "https://api.rule34.xxx"
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

        // User-Agent لآيفون سفاري 📱
        const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

        // البحث باستخدام API r34.app
        // هذا الـ API يعمل كـ wrapper لـ rule34.xxx
        const searchUrl = `${API_CONFIG.baseUrl}/posts?tags=${encodeURIComponent(keyword + " video")}&limit=100`;
        
        const response = await axios.get(searchUrl, {
            headers: { 
                'User-Agent': userAgent,                'Accept': 'application/json'
            },
            timeout: 15000
        });

        const data = response.data;
        
        // r34.app API يعيد البيانات بشكل مختلف
        const posts = data.posts || data.data || [];

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
            const fileUrl = post.file?.url || post.file_url || post.source;
            const fileExt = post.file?.ext || post.file_ext || '';
            return (fileExt === 'mp4' || fileExt === 'webm' || 
                    (fileUrl && (fileUrl.includes('.mp4') || fileUrl.includes('.webm'))));
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
        
        // استخراج رابط الفيديو
        const videoUrl = randomPost.file?.url || randomPost.file_url || randomPost.source;
        const videoExt = randomPost.file?.ext || randomPost.file_ext || 'mp4';
        
        if (!videoUrl) {
            throw new Error("لا يوجد رابط فيديو صالح");
        }
        const videoPath = path.join(cacheDir, `r34_${Date.now()}.${videoExt}`);

        // تنزيل الفيديو
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
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

        if (stats.size > 25 * 1024 * 1024) { 
            fs.unlinkSync(videoPath);
            if (api.setMessageReaction) {
                api.setMessageReaction("❌", event.messageID, () => {}, true);
            }
            return api.sendMessage(
                `الفيديو كبير جداً (${sizeInMB} MB). جرب كلمة بحث أخرى!`,
                event.threadID,
                event.messageID
            );
        }

        // معلومات إضافية عن الفيديو
        const tags = randomPost.tags?.join(", ") || keyword;
        const rating = randomPost.rating || 'N/A';

        await api.sendMessage(
            {
                body: `🎬 Rule34 Video\n البحث: ${keyword}\n📊 الحجم: ${sizeInMB} MB\n⭐ التقييم: ${rating}\n\n🔞 18+`,
                attachment: fs.createReadStream(videoPath),
            },
            event.threadID,
            () => {
                fs.unlink(videoPath, (err) => {
                    if (err) console.error("خطأ في حذف الملف:", err);
                });
                if (api.setMessageReaction) {                    api.setMessageReaction("✅", event.messageID, () => {}, true);
                }
            }
        );

    } catch (error) {
        console.error("Rule34 Error:", error);
        
        if (api.setMessageReaction) {
            api.setMessageReaction("❌", event.messageID, () => {}, true);
        }

        let errorMsg = "حدث خطأ أثناء البحث";
        
        if (error.code === 'ECONNABORTED') {
            errorMsg = "انتهت مهلة الاتصال. جرب مرة أخرى";
        } else if (error.response) {
            if (error.response.status === 404) {
                errorMsg = "لم يتم العثور على نتائج";
            } else if (error.response.status === 429) {
                errorMsg = "تم تجاوز حد الطلبات. انتظر قليلاً";
            } else {
                errorMsg += ` (${error.response.status})`;
            }
        }
        
        api.sendMessage(
            `${errorMsg}: ${error.message}`,
            event.threadID,
            event.messageID
        );
    }
};