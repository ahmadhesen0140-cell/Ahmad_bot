const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
    title: "رول34 فيديو",
    release: "2.0",
    clearance: 18,
    author: "Hakim Tracks",
    summary: "بحث وتحميل فيديوهات من موقع Rule34",
    section: "عـــامـة",
    syntax: "rule34 <التاغ / كلمة البحث>",
    delay: 5,
};

module.exports.HakimRun = async function ({ api, event, args }) {
    const keyword = args.join(" ");
    if (!keyword) {
        return api.sendMessage(
            "عزيزي، ما الذي تريد البحث عنه؟ 🔍\nمثال: rule34 video overwatch",
            event.threadID,
            event.messageID
        );
    }

    const cacheDir = path.join(__dirname, "cache");
    await fs.ensureDir(cacheDir);

    try {
        // وضع تفاعل الانتظار
        if (api.setMessageReaction) {
            api.setMessageReaction("⌛", event.messageID, () => {}, true);
        }

        // جلب البيانات من Rule34 API
        const apiUrl = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(keyword + " video")}&limit=50`;
        
        const response = await axios.get(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const posts = response.data;

        if (!posts || posts.length === 0) {
            if (api.setMessageReaction) {
                api.setMessageReaction("❌", event.messageID, () => {}, true);
            }
            return api.sendMessage(                "لم يتم العثور على فيديوهات لهذه الكلمات. جرب كلمات أخرى!",
                event.threadID,
                event.messageID
            );
        }

        // تصفية الفيديوهات فقط (mp4, webm)
        const videoPosts = posts.filter(post => {
            const fileExt = post.file_ext ? post.file_ext.toLowerCase() : '';
            return fileExt === 'mp4' || fileExt === 'webm';
        });

        if (videoPosts.length === 0) {
            if (api.setMessageReaction) {
                api.setMessageReaction("❌", event.messageID, () => {}, true);
            }
            return api.sendMessage(
                "لم يتم العثور على فيديوهات، فقط صور. جرب إضافة 'video' للبحث!",
                event.threadID,
                event.messageID
            );
        }

        // اختيار فيديو عشوائي من النتائج
        const randomPost = videoPosts[Math.floor(Math.random() * videoPosts.length)];
        const videoUrl = randomPost.file_url;
        const videoExt = randomPost.file_ext || 'mp4';
        const videoPath = path.join(cacheDir, `r34_${Date.now()}.${videoExt}`);

        // تنزيل الفيديو
        const videoResponse = await axios({
            method: "GET",
            url: videoUrl,
            responseType: "stream",
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const writer = fs.createWriteStream(videoPath);
        videoResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        // التحقق من حجم الملف
        const stats = fs.statSync(videoPath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);        
        if (stats.size > 25 * 1024 * 1024) { 
            fs.unlinkSync(videoPath);
            if (api.setMessageReaction) {
                api.setMessageReaction("❌", event.messageID, () => {}, true);
            }
            return api.sendMessage(
                `الفيديو كبير جداً (${sizeInMB} ميجابايت). جرب كلمات بحث أخرى!`,
                event.threadID,
                event.messageID
            );
        }

        // معلومات إضافية
        const tags = randomPost.tags || '';
        const rating = randomPost.rating || 'N/A';
        
        // إرسال الفيديو
        await api.sendMessage(
            {
                body: `🎬 Rule34 Video\n📌 الكلمات: ${keyword}\n📊 الحجم: ${sizeInMB} MB\n⭐ التقييم: ${rating}\n\n🔞 محتوى للبالغين فقط`,
                attachment: fs.createReadStream(videoPath),
            },
            event.threadID,
            () => {
                // حذف الملف المؤقت بعد الإرسال
                fs.unlink(videoPath, (err) => {
                    if (err) console.error("خطأ في حذف الملف:", err);
                });
                if (api.setMessageReaction) {
                    api.setMessageReaction("✅", event.messageID, () => {}, true);
                }
            }
        );

    } catch (error) {
        console.error("Rule34 Video Error:", error);
        if (api.setMessageReaction) {
            api.setMessageReaction("❌", event.messageID, () => {}, true);
        }
        
        let errorMsg = "حدث خطأ أثناء البحث أو التنزيل";
        if (error.response) {
            errorMsg += ` (Status: ${error.response.status})`;
        } else if (error.code === 'ECONNABORTED') {
            errorMsg = "انتهت مهلة الاتصال. جرب مرة أخرى";
        }
        
        api.sendMessage(
            `${errorMsg}: ${error.message}`,            event.threadID,
            event.messageID
        );
    }
};