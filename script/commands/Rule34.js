const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const baseApiUrl = async () => {
    const base = await axios.get("https://raw.githubusercontent.com/mahmudx7/HINATA/main/baseApiUrl.json");
    return base.data.mahmud;
};

module.exports.config = {
    title: 'Rule34',
    release: '2.0',
    clearance: 18,
    author: "Hakim Tracks",
    summary: 'بحث وتحميل صور من Rule34 مع إمكانية جلب المزيد',
    section: 'عـــامـة',
    syntax: '[كلمة بحث] - [عدد] (مثال: anime - 10)',
    delay: 10,
};

module.exports.HakimRun = async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const queryAndLength = args.join(' ').split('-').map(s => s.trim());
    const keySearch = queryAndLength[0];
    const countInput = queryAndLength[1];
    const displayCount = countInput ? Math.min(parseInt(countInput), 20) : 6;

    if (!keySearch) return api.sendMessage('✘ يرجى إدخال كلمة البحث', threadID, messageID);

    const cacheDir = path.join(__dirname, 'cache');
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    api.setMessageReaction('⏳', messageID, () => {}, true);

    try {
        // Rule34 API endpoint
        const apiUrl = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(keySearch)}&limit=100`;
        
        const response = await axios.get(apiUrl);
        
        let allImages = response.data;
        
        if (!Array.isArray(allImages) || allImages.length === 0) {
            api.setMessageReaction('✘', messageID, () => {}, true);
            return api.sendMessage('✘ لا توجد صور', threadID, messageID);
        }

        // Extract image URLs and remove duplicates
        const imageUrls = allImages
            .filter(post => post.file_url || post.sample_url)            .map(post => post.file_url || post.sample_url);
        
        const imageSet = new Set(imageUrls);
        allImages = Array.from(imageSet);

        const imagesToShow = allImages.slice(0, displayCount);
        if (imagesToShow.length === 0) {
            api.setMessageReaction('✘', messageID, () => {}, true);
            return api.sendMessage('✘ لا توجد صور كافية للعرض', threadID, messageID);
        }

        const attachments = [];
        for (let i = 0; i < imagesToShow.length; i++) {
            const imgRes = await axios.get(imagesToShow[i], { responseType: 'arraybuffer' });
            const imgPath = path.join(cacheDir, `r34_${Date.now()}_${i}.jpg`);
            await fs.outputFile(imgPath, imgRes.data);
            attachments.push(fs.createReadStream(imgPath));
        }

        const msg = `✔ تم العثور على ${allImages.length} صورة لـ "${keySearch}"\nعرض ${imagesToShow.length} منها\nتفاعل بـ 👍 لجلب المزيد`;

        api.sendMessage({
            body: msg,
            attachment: attachments
        }, threadID, (err, info) => {
            if (err) return;
            
            for (const att of attachments) {
                if (fs.existsSync(att.path)) fs.unlinkSync(att.path);
            }
            
            Mirror.client.HakimReaction.push({
                name: module.exports.config.title,
                messageID: info.messageID,
                author: event.senderID,
                type: 'more',
                keyword: keySearch,
                allImages: allImages,
                startIndex: displayCount,
                displayCount: displayCount,
                totalFetched: allImages.length
            });
        }, messageID);
    } catch (err) {
        api.setMessageReaction('✘', messageID, () => {}, true);
        api.sendMessage('✘ خطأ: ' + err.message, threadID, messageID);
    }
};

module.exports.HakimReaction = async ({ api, event, HakimReaction }) => {    const { threadID, messageID, userID, reaction } = event;
         
    if (reaction !== '👍') return;
      
    if (userID !== HakimReaction.author) {
        return api.sendMessage('✘ أنت لست صاحب البحث', threadID, messageID);
    }
    
    if (HakimReaction.type !== 'more') return;

    const { keyword, allImages, startIndex, displayCount } = HakimReaction;
    const cacheDir = path.join(__dirname, 'cache');

    api.setMessageReaction('⏳', messageID, () => {}, true);

    try {
        let updatedImages = allImages;
        let newStartIndex = startIndex;

        if (startIndex >= allImages.length) {
            // Fetch more images from Rule34 API
            const apiUrl = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(keyword)}&limit=100&pid=${Math.floor(startIndex / 100)}`;
            
            const response = await axios.get(apiUrl);
            const newImages = response.data || [];
            
            if (!Array.isArray(newImages) || newImages.length === 0) {
                api.setMessageReaction('✘', messageID, () => {}, true);
                return api.sendMessage('✘ لا توجد صور إضافية', threadID, messageID);
            }

            const newImageUrls = newImages
                .filter(post => post.file_url || post.sample_url)
                .map(post => post.file_url || post.sample_url);
            
            const combinedSet = new Set([...allImages, ...newImageUrls]);
            updatedImages = Array.from(combinedSet);
            newStartIndex = allImages.length;
        }

        const nextBatch = updatedImages.slice(newStartIndex, newStartIndex + displayCount);
        if (nextBatch.length === 0) {
            api.setMessageReaction('✘', messageID, () => {}, true);
            return api.sendMessage('✘ لا توجد صور إضافية', threadID, messageID);
        }

        const attachments = [];
        for (let i = 0; i < nextBatch.length; i++) {
            const imgRes = await axios.get(nextBatch[i], { responseType: 'arraybuffer' });
            const imgPath = path.join(cacheDir, `r34_${Date.now()}_${i}.jpg`);            await fs.outputFile(imgPath, imgRes.data);
            attachments.push(fs.createReadStream(imgPath));
        }

        const totalImages = updatedImages.length;
        const shownSoFar = newStartIndex + nextBatch.length;
        const msg = `✔ صور إضافية لـ "${keyword}" (${shownSoFar}/${totalImages} صورة)\nتفاعل بـ 👍 لجلب المزيد`;

        api.sendMessage({
            body: msg,
            attachment: attachments
        }, threadID, (err, info) => {
            if (err) return;
            
            for (const att of attachments) {
                if (fs.existsSync(att.path)) fs.unlinkSync(att.path);
            }
            
            const index = Mirror.client.HakimReaction.findIndex(h => h.messageID === HakimReaction.messageID);
            if (index !== -1) {
                Mirror.client.HakimReaction[index] = {
                    ...HakimReaction,
                    messageID: info.messageID,
                    allImages: updatedImages,
                    startIndex: newStartIndex + displayCount,
                };
            }
        }, messageID);
    } catch (err) {
        api.setMessageReaction('✘', messageID, () => {}, true);
        api.sendMessage('✘ خطأ: ' + err.message, threadID, messageID);
    }
};