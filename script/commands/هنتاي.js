const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

// 🔑 Rule34 API Configuration - معلومات الـ API الخاصة بك
const API_CONFIG = {
    baseUrl: 'https://api.rule34.xxx',
    user_id: '6295350',
    api_key: '1f1456c603d702d879a2c127b35bdc94d6602950a4ec49f0f6a4524b45004a572c93ccc94e53425fda1df9708520038ce4aacf06ca7f6a2dbfbed914b061a05d'
};

// 📱 iPhone Safari User-Agent
const USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// ⚙️ إعدادات عامة
const CONFIG = {
    maxFilesPerRequest: 20,    // الحد الأقصى للملفات المرسلة دفعة واحدة
    maxFileSize: 25 * 1024 * 1024,  // 25MB limit
    apiLimit: 100,             // عدد النتائج من الـ API
    cacheFolder: 'هنتاي'
};

module.exports.config = {
    title: 'هنتاي',
    release: '4.0',
    clearance: 18,
    author: "Hakim Tracks",
    summary: 'بحث وتحميل صور/فيديوهات هنتاي من Rule34 مع دعم التصفح',
    section: '18+',
    syntax: 'هنتاي [كلمة بحث] - [عدد] (مثال: هنتاي naruto - 10)',
    delay: 10,
};

/**
 * 🛠️ دالة بناء رابط الـ API ديناميكياً
 */
function buildApiUrl(tags, limit = CONFIG.apiLimit, page = 0) {
    const encodedTags = encodeURIComponent(tags);
    return `${API_CONFIG.baseUrl}/index.php?page=dapi&s=post&q=index&json=1&tags=${encodedTags}&limit=${limit}&pid=${page}&user_id=${API_CONFIG.user_id}&api_key=${API_CONFIG.api_key}`;
}

/**
 * 🎯 دالة تصفية الملفات الصالحة (صور + فيديوهات)
 */function filterValidPosts(posts) {
    const validExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm'];
    return posts
        .filter(post => post.file_url && validExts.includes((post.file_ext || '').toLowerCase()))
        .map(post => ({
            id: post.id,
            url: post.file_url,
            ext: (post.file_ext || 'jpg').toLowerCase(),
            tags: post.tags || '',
            rating: post.rating || 'N/A',
            width: post.width,
            height: post.height
        }));
}

/**
 * 📥 دالة تنزيل ملف مع التحقق من الحجم
 */
async function downloadFile(url, filePath) {
    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        headers: { 'User-Agent': USER_AGENT },
        timeout: 40000,
        maxContentLength: CONFIG.maxFileSize + 5 * 1024 * 1024
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(filePath));
        writer.on('error', reject);
    });
}

/**
 * 🚀 الدالة الرئيسية: تنفيذ الأمر
 */
module.exports.HakimRun = async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;
    
    // تحليل المدخلات: كلمة البحث والعدد
    const input = args.join(' ').trim();
    const parts = input.split('-').map(s => s.trim());
    const keyword = parts[0];
    const countInput = parts[1];
    const displayCount = countInput ? Math.min(parseInt(countInput), CONFIG.maxFilesPerRequest) : 6;
    if (!keyword) {
        return api.sendMessage(
            '🔍 الاستخدام: هنتاي [كلمة بحث] - [عدد]\n' +
            'أمثلة:\n' +
            '• هنتاي naruto\n' +
            '• هنتاي anime video - 5\n' +
            '• هنتاي game - 10',
            threadID, messageID
        );
    }

    // إعداد مجلد الكاش
    const cacheDir = path.join(__dirname, 'cache', CONFIG.cacheFolder);
    await fs.ensureDir(cacheDir);

    // تفاعل الانتظار
    if (api.setMessageReaction) {
        api.setMessageReaction('⏳', messageID, () => {}, true);
    }

    try {
        // 📡 الطلب من الـ API
        const apiUrl = buildApiUrl(keyword, CONFIG.apiLimit, 0);
        const response = await axios.get(apiUrl, {
            headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
            timeout: 25000
        });

        const posts = response.data;

        if (!Array.isArray(posts) || posts.length === 0) {
            if (api.setMessageReaction) api.setMessageReaction('❌', messageID, () => {}, true);
            return api.sendMessage(`❌ لم يتم العثور على نتائج لـ "${keyword}"\n💡 جرب كلمات بحث بالإنجليزي`, threadID, messageID);
        }

        // تصفية وتنظيف النتائج
        const validFiles = filterValidPosts(posts);
        if (validFiles.length === 0) {
            if (api.setMessageReaction) api.setMessageReaction('❌', messageID, () => {}, true);
            return api.sendMessage('❌ لا توجد ملفات قابلة للتحميل', threadID, messageID);
        }

        // إزالة التكرار
        const uniqueFiles = Array.from(new Map(validFiles.map(f => [f.url, f])).values());
        
        // تحديد الملفات للعرض
        const filesToShow = uniqueFiles.slice(0, displayCount);
        if (filesToShow.length === 0) {
            if (api.setMessageReaction) api.setMessageReaction('❌', messageID, () => {}, true);
            return api.sendMessage('❌ لا توجد ملفات كافية للعرض', threadID, messageID);        }

        // 📥 تنزيل الملفات
        const attachments = [];
        const failedFiles = [];

        for (let i = 0; i < filesToShow.length; i++) {
            const file = filesToShow[i];
            const fileName = `هنتاي_${Date.now()}_${i}.${file.ext}`;
            const filePath = path.join(cacheDir, fileName);

            try {
                await downloadFile(file.url, filePath);
                
                // التحقق من الحجم
                const stats = fs.statSync(filePath);
                if (stats.size > CONFIG.maxFileSize) {
                    fs.unlinkSync(filePath);
                    failedFiles.push(`ملف ${i+1} كبير جداً`);
                    continue;
                }
                
                attachments.push(fs.createReadStream(filePath));
            } catch (err) {
                console.error(`❌ فشل تنزيل ${file.url}:`, err.message);
                failedFiles.push(`فشل ملف ${i+1}`);
            }
        }

        if (attachments.length === 0) {
            if (api.setMessageReaction) api.setMessageReaction('❌', messageID, () => {}, true);
            return api.sendMessage('❌ فشل تنزيل جميع الملفات', threadID, messageID);
        }

        // 📝 تحضير الرسالة
        const firstFile = filesToShow[0];
        const rating = firstFile.rating ? firstFile.rating.toUpperCase() : 'N/A';
        const type = ['mp4', 'webm'].includes(firstFile.ext) ? '🎥 فيديو' : '🖼️ صورة';
        
        const caption = `🔞 هنتاي\n` +
            `📌 البحث: ${keyword}\n` +
            `📊 المعروض: ${attachments.length}/${filesToShow.length}\n` +
            `📦 النوع: ${type}\n` +
            `⭐ التقييم: ${rating}\n\n` +
            `🔞 18+ Content\n` +
            `👍 تفاعل لجلب المزيد`;

        // 📤 إرسال الرسالة
        api.sendMessage({
            body: caption,            attachment: attachments
        }, threadID, (err, info) => {
            // 🗑️ حذف الملفات المؤقتة
            attachments.forEach(att => {
                if (att.path && fs.existsSync(att.path)) {
                    fs.unlink(att.path, e => e && console.error('❌ حذف فشل:', e));
                }
            });

            if (err) return;
            
            if (api.setMessageReaction) {
                api.setMessageReaction('✅', messageID, () => {}, true);
            }

            // 💾 حفظ حالة التصفح لـ HakimReaction
            if (typeof Mirror !== 'undefined' && Mirror.client?.HakimReaction) {
                Mirror.client.HakimReaction.push({
                    name: module.exports.config.title,
                    messageID: info.messageID,
                    author: senderID,
                    type: 'more',
                    keyword: keyword,
                    allFiles: uniqueFiles,
                    startIndex: displayCount,
                    displayCount: displayCount,
                    totalFetched: uniqueFiles.length,
                    page: 0
                });
            }
        }, messageID);

        // ⚠️ إرسال ملاحظات الأخطاء إن وجدت
        if (failedFiles.length > 0) {
            setTimeout(() => {
                api.sendMessage(`⚠️ لم يتم تنزيل ${failedFiles.length} ملف:\n${failedFiles.slice(0, 3).join('\n')}`, threadID);
            }, 2000);
        }

    } catch (error) {
        console.error('🔴 هنتاي Error:', error);
        
        if (api.setMessageReaction) {
            api.setMessageReaction('❌', messageID, () => {}, true);
        }

        let errorMsg = '❌ خطأ: ';
        if (error.code === 'ECONNABORTED') {
            errorMsg += 'انتهت مهلة الاتصال ⏱️';
        } else if (error.code === 'ECONNREFUSED') {            errorMsg += 'لا يمكن الاتصال بالخادم 🔌';
        } else if (error.response?.status === 403) {
            errorMsg += 'API Key غير صالح 🚫';
        } else if (error.response?.status === 429) {
            errorMsg += 'تم تجاوز الحد، انتظر قليلاً ⏳';
        } else {
            errorMsg += error.message || 'خطأ غير معروف';
        }

        api.sendMessage(errorMsg, threadID, messageID);
    }
};

/**
 * 🔄 دالة التفاعل: جلب المزيد عند الضغط على 👍
 */
module.exports.HakimReaction = async ({ api, event, HakimReaction }) => {
    const { threadID, messageID, userID, reaction } = event;

    // التحقق من التفاعل
    if (reaction !== '👍') return;
    if (userID !== HakimReaction.author) {
        return api.sendMessage('✘ أنت لست صاحب البحث', threadID, messageID);
    }
    if (HakimReaction.type !== 'more') return;

    const { keyword, allFiles, startIndex, displayCount, page } = HakimReaction;
    const cacheDir = path.join(__dirname, 'cache', CONFIG.cacheFolder);
    await fs.ensureDir(cacheDir);

    if (api.setMessageReaction) {
        api.setMessageReaction('⏳', messageID, () => {}, true);
    }

    try {
        let updatedFiles = allFiles;
        let newStartIndex = startIndex;
        let newPage = page;

        // إذا انتهت القائمة، نجلب صفحة جديدة من الـ API
        if (startIndex >= allFiles.length) {
            const nextPage = newPage + 1;
            const apiUrl = buildApiUrl(keyword, CONFIG.apiLimit, nextPage);
            
            const response = await axios.get(apiUrl, {
                headers: { 'User-Agent': USER_AGENT },
                timeout: 25000
            });

            const newPosts = response.data;            if (!Array.isArray(newPosts) || newPosts.length === 0) {
                if (api.setMessageReaction) api.setMessageReaction('❌', messageID, () => {}, true);
                return api.sendMessage('✘ لا توجد نتائج إضافية', threadID, messageID);
            }

            const newFiles = filterValidPosts(newPosts);
            const combined = [...allFiles, ...newFiles];
            updatedFiles = Array.from(new Map(combined.map(f => [f.url, f])).values());
            newStartIndex = allFiles.length;
            newPage = nextPage;
        }

        // تحديد الدفعة التالية
        const nextBatch = updatedFiles.slice(newStartIndex, newStartIndex + displayCount);
        if (nextBatch.length === 0) {
            if (api.setMessageReaction) api.setMessageReaction('❌', messageID, () => {}, true);
            return api.sendMessage('✘ لا توجد ملفات إضافية', threadID, messageID);
        }

        // تنزيل الملفات الجديدة
        const attachments = [];
        for (let i = 0; i < nextBatch.length; i++) {
            const file = nextBatch[i];
            const fileName = `هنتاي_${Date.now()}_${i}.${file.ext}`;
            const filePath = path.join(cacheDir, fileName);

            try {
                await downloadFile(file.url, filePath);
                const stats = fs.statSync(filePath);
                if (stats.size <= CONFIG.maxFileSize) {
                    attachments.push(fs.createReadStream(filePath));
                } else {
                    fs.unlinkSync(filePath);
                }
            } catch (err) {
                console.error('Download error:', err.message);
            }
        }

        if (attachments.length === 0) {
            if (api.setMessageReaction) api.setMessageReaction('❌', messageID, () => {}, true);
            return api.sendMessage('✘ فشل تنزيل الملفات الإضافية', threadID, messageID);
        }

        // إرسال الدفعة الجديدة
        const total = updatedFiles.length;
        const shown = newStartIndex + attachments.length;
        const caption = `🔞 هنتاي - المزيد\n📌 ${keyword}\n📊 ${shown}/${total}\n👍 تفاعل للمزيد`;

        api.sendMessage({            body: caption,
            attachment: attachments
        }, threadID, (err, info) => {
            // حذف الملفات المؤقتة
            attachments.forEach(att => {
                if (att.path && fs.existsSync(att.path)) {
                    fs.unlink(att.path, e => e && console.error('Delete error:', e));
                }
            });

            if (err) return;

            // تحديث حالة التصفح
            if (typeof Mirror !== 'undefined' && Mirror.client?.HakimReaction) {
                const index = Mirror.client.HakimReaction.findIndex(h => h.messageID === HakimReaction.messageID);
                if (index !== -1) {
                    Mirror.client.HakimReaction[index] = {
                        ...HakimReaction,
                        messageID: info.messageID,
                        allFiles: updatedFiles,
                        startIndex: newStartIndex + displayCount,
                        page: newPage
                    };
                }
            }
        }, messageID);

    } catch (error) {
        console.error('HakimReaction Error:', error);
        if (api.setMessageReaction) api.setMessageReaction('❌', messageID, () => {}, true);
        api.sendMessage(`❌ خطأ: ${error.message}`, threadID, messageID);
    }
};
