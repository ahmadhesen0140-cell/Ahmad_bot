const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

// 🔑 معلومات الـ API الخاصة بك
const API_CONFIG = {
    user_id: '6295350',
    api_key: '1f1456c603d702d879a2c127b35bdc94d6602950a4ec49f0f6a4524b45004a572c93ccc94e53425fda1df9708520038ce4aacf06ca7f6a2dbfbed914b061a05d'
};

// 📱 iPhone Safari User-Agent
const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

module.exports.config = {
    title: "rule34",
    release: "3.0",
    clearance: 18,
    author: "Hakim Tracks",
    summary: "بحث وتحميل صور/فيديوهات من Rule34.xxx",
    section: "18+",
    syntax: "rule34 <كلمة البحث> [-عدد]",
    delay: 5,
};

module.exports.HakimRun = async function ({ api, event, args }) {
    const keyword = args.join(" ").trim();
    
    if (!keyword) {
        return api.sendMessage(
            "🔍 كيفية الاستخدام:\n" +
            "rule34 <كلمة البحث>\n\n" +
            "أمثلة:\n" +
            "• rule34 naruto\n" +
            "• rule34 anime video\n" +
            "• rule34 game -5 (لجلب 5 صور)",
            event.threadID,
            event.messageID
        );
    }

    // التحقق من وجود عدد محدد
    let count = 3; // الافتراضي
    const countMatch = keyword.match(/-(\d+)$/);
    if (countMatch) {
        count = Math.min(parseInt(countMatch[1]), 10); // الحد الأقصى 10
        keyword.replace(/-\d+$/, "").trim();
    }

    const cacheDir = path.join(__dirname, "cache", "rule34");
    await fs.ensureDir(cacheDir);
    try {
        if (api.setMessageReaction) {
            api.setMessageReaction("⌛", event.messageID, () => {}, true);
        }

        // تنظيف كلمة البحث
        const searchQuery = encodeURIComponent(keyword + " video");
        
        // جلب البيانات من Rule34 API
        const apiUrl = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${searchQuery}&limit=100`;
        
        const response = await axios.get(apiUrl, {
            headers: { 
                'User-Agent': userAgent,
                'Accept': 'application/json'
            },
            params: {
                user_id: API_CONFIG.user_id,
                api_key: API_CONFIG.api_key
            },
            timeout: 15000
        });

        const posts = response.data;

        if (!posts || posts.length === 0) {
            if (api.setMessageReaction) {
                api.setMessageReaction("❌", event.messageID, () => {}, true);
            }
            return api.sendMessage(
                `❌ لم يتم العثور على نتائج لـ "${keyword}"\n\n💡 جرب:\n- كلمات بحث بالإنجليزي\n- إضافة "video" للبحث عن فيديوهات`,
                event.threadID,
                event.messageID
            );
        }

        // تصفية المحتوى (فيديوهات أو صور)
        const isVideoSearch = keyword.toLowerCase().includes("video");
        const filteredPosts = posts.filter(post => {
            const fileExt = (post.file_ext || "").toLowerCase();
            if (isVideoSearch) {
                return (fileExt === 'mp4' || fileExt === 'webm') && post.file_url;
            } else {
                return (fileExt === 'jpg' || fileExt === 'png' || fileExt === 'jpeg' || 
                        fileExt === 'mp4' || fileExt === 'webm') && post.file_url;
            }
        });

        if (filteredPosts.length === 0) {            if (api.setMessageReaction) {
                api.setMessageReaction("❌", event.messageID, () => {}, true);
            }
            return api.sendMessage(
                "❌ لم يتم العثور على محتوى مناسب!",
                event.threadID,
                event.messageID
            );
        }

        // اختيار عشوائي أو حسب العدد المطلوب
        const selectedPosts = [];
        const availableCount = Math.min(count, filteredPosts.length);
        
        for (let i = 0; i < availableCount; i++) {
            const randomIndex = Math.floor(Math.random() * filteredPosts.length);
            selectedPosts.push(filteredPosts[randomIndex]);
        }

        // تنزيل وإرسال المحتوى
        let successCount = 0;
        const attachments = [];
        const failedUrls = [];

        for (let i = 0; i < selectedPosts.length; i++) {
            const post = selectedPosts[i];
            const fileUrl = post.file_url;
            const fileExt = (post.file_ext || "jpg").toLowerCase();
            const fileName = `r34_${Date.now()}_${i}.${fileExt}`;
            const filePath = path.join(cacheDir, fileName);

            try {
                const fileResponse = await axios({
                    method: "GET",
                    url: fileUrl,
                    responseType: "stream",
                    headers: { 'User-Agent': userAgent },
                    timeout: 30000
                });

                const writer = fs.createWriteStream(filePath);
                fileResponse.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on("finish", resolve);
                    writer.on("error", reject);
                });

                // التحقق من حجم الملف
                const stats = fs.statSync(filePath);                const sizeInMB = stats.size / (1024 * 1024);

                if (sizeInMB > 25) {
                    fs.unlinkSync(filePath);
                    failedUrls.push(`ملف ${i + 1} كبير جداً (${sizeInMB.toFixed(2)} MB)`);
                    continue;
                }

                attachments.push(fs.createReadStream(filePath));
                successCount++;

            } catch (err) {
                console.error(`Error downloading file ${i}:`, err.message);
                failedUrls.push(`فشل تنزيل ملف ${i + 1}`);
            }
        }

        if (successCount === 0) {
            if (api.setMessageReaction) {
                api.setMessageReaction("❌", event.messageID, () => {}, true);
            }
            return api.sendMessage(
                "❌ فشل تنزيل أي ملف!\n" + failedUrls.join("\n"),
                event.threadID,
                event.messageID
            );
        }

        // تحضير الرسالة
        const rating = selectedPosts[0].rating || "N/A";
        const tags = selectedPosts[0].tags ? selectedPosts[0].tags.split(" ").slice(0, 5).join(", ") : "";
        
        const messageBody = `🔞 Rule34 Result\n\n` +
            `📌 البحث: ${keyword}\n` +
            `📊 العدد: ${successCount}/${selectedPosts.length}\n` +
            `⭐ التقييم: ${rating.toUpperCase()}\n` +
            `🏷️ Tags: ${tags}\n\n` +
            `🔞 18+ Content`;

        // إرسال الرسالة مع المرفقات
        await api.sendMessage({
            body: messageBody,
            attachment: attachments
        }, event.threadID, (err, info) => {
            // حذف الملفات المؤقتة
            attachments.forEach((att, index) => {
                if (att.path && fs.existsSync(att.path)) {
                    fs.unlink(att.path, (unlinkErr) => {
                        if (unlinkErr) console.error("Error deleting file:", unlinkErr);
                    });                }
            });
            
            if (api.setMessageReaction) {
                api.setMessageReaction("✅", event.messageID, () => {}, true);
            }
        }, event.messageID);

        // إرسال رسالة الأخطاء إن وجدت
        if (failedUrls.length > 0) {
            setTimeout(() => {
                api.sendMessage(
                    `⚠️ ملاحظات:\n${failedUrls.join("\n")}`,
                    event.threadID
                );
            }, 2000);
        }

    } catch (error) {
        console.error("Rule34 Error:", error);
        
        if (api.setMessageReaction) {
            api.setMessageReaction("❌", event.messageID, () => {}, true);
        }

        let errorMsg = "❌ حدث خطأ:\n";
        
        if (error.code === 'ECONNABORTED') {
            errorMsg += "⏱️ انتهت مهلة الاتصال. جرب مرة أخرى";
        } else if (error.response) {
            switch (error.response.status) {
                case 401:
                    errorMsg += "🔑 API Key غير صحيح أو منتهي";
                    break;
                case 403:
                    errorMsg += "🚫 الوصول مرفوض. تحقق من الصلاحيات";
                    break;
                case 404:
                    errorMsg += "📭 لم يتم العثور على نتائج";
                    break;
                case 429:
                    errorMsg += "⏳ تم تجاوز حد الطلبات. انتظر قليلاً";
                    break;
                default:
                    errorMsg += `خطأ ${error.response.status}: ${error.message}`;
            }
        } else {
            errorMsg += error.message;
        }
        api.sendMessage(errorMsg, event.threadID, event.messageID);
    }
};
