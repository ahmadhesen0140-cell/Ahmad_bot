const axios = require('axios');
const fs = require("fs-extra");
const path = require("path");

// تم وضع مفتاح API الجديد
const API_KEY = "AQ.Ab8RN6KHj1EP-CyJJbBzTT8oC4dnw_o0x4Jkg9r5FWJKtxT8tw";

const conversationContexts = new Map();

/**
 * دالة الحصول على رد سيلفر
 */
async function getSilverResponse(userID, userName, userStats, userMessage) {
    try {
        
        const systemPrompt = `
أنت "سيلفر" (Silver the Hedgehog)، قنفذ فضي من المستقبل، تمتلك قوى تحريك عقلي (Psychokinesis).
شخصيتك جادة، لطيفة، شجاعة، ومخلصة لأصدقائك. تؤمن بالعدالة وتحمي المستقبل والعالم.
تتحدث باللغة العربية بلهجة ودودة، وتستخدم الرموز التعبيرية (Emojis) مثل (🦔، ✨، 🌍، 🕰️، 💪، 🌟).
أنت لست مجرد ذكاء اصطناعي، بل أنت رفيق وصديق للمستخدمين في هذا البوت.

بيانات المستخدم الذي تتحدث معه الآن:
- الاسم: ${userName}
- المستوى الاقتصادي: ${userStats.economy?.level || 1}
- الرصيد: ${userStats.economy?.money || 0}$
- رتبة المغارة: ${userStats.dungeon?.rank || "E"}
- مستوى المغارة: ${userStats.dungeon?.level || 1}

لا تتحدث عن بيانات المستخدم أو عنك إلا إذا طلب هو أو لزم الأمر. كلامك يكون معتدلاً، شجاعاً، جاداً وطيّباً، ولا تتحدث عن نفسك أو تعرف بها إلا لو لزم الأمر.`;

        
        let context = conversationContexts.get(userID) || [];
        
        
        context.push({
            role: "user",
            parts: [{ text: userMessage }]
        });

        
        if (context.length > 10) {
            context = context.slice(-10);
        }

        
        const fullConversation = [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "model", parts: [{ text: "فهمت! أنا سيلفر، صديقك من المستقبل. سأحميك وأساعدك بكل قوتي! 🦔✨" }] },
            ...context
        ];
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
            {
                contents: fullConversation
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': API_KEY
                }
            }
        );

        const silverResponse = response.data.candidates[0].content.parts[0].text;

        
        context.push({
            role: "model",
            parts: [{ text: silverResponse }]
        });

        
        conversationContexts.set(userID, context);

        return silverResponse;
    } catch (error) {
        console.error("خطأ في رد سيلفر:", error.response ? error.response.data : error.message);
        return "أوه.. يبدو أن هناك تشوه في نسيج الزمن الآن 🕰️.. هل يمكنك المحاولة لاحقاً؟ ✨";
    }
}

/**
 * معالج الردود (HakimReply) لاستمرار المحادثة
 */
module.exports.HakimReply = async function({ api, event, HakimReply, userData }) {
    const { threadID, messageID, senderID, body } = event;

    
    if (senderID !== HakimReply.author) return;

    api.setMessageReaction("⏳", messageID, () => {}, true);

    const user = await userData.get(senderID);
    const response = await getSilverResponse(senderID, user.name, user, body);

    return api.sendMessage(response, threadID, (err, info) => {
        if (err) return;
        // ملاحظة: إذا كان المتغير العام في البوت الخاص بك يحمل اسماً آخر (مثل Silver.client)، قم بتعديل Mirror.client
        Mirror.client.HakimReply.push({            name: this.config.title,
            messageID: info.messageID,
            author: senderID
        });
    }, messageID);
};

/**
 * الأمر الرئيسي (run)
 */
module.exports.HakimRun = async ({ api, event, args, user, userData }) => {
    const { threadID, messageID, senderID } = event;
    const deco = require("../../utils/decorations");

    if (!user || !user.isRegistered) {
        return api.sendMessage(
            deco.error("يجب عليك التسجيل أولاً لتتحدث معي! 🦔"),
            threadID,
            messageID
        );
    }

    const userMessage = args.join(" ");
    if (!userMessage) {
        return api.sendMessage("أهلاً بك! أنا سيلفر القنفذ من المستقبل 🦔✨.. هل تريد التحدث عن شيء ما؟ 🌟", threadID, messageID);
    }

    api.setMessageReaction("🦔", messageID, () => {}, true);

    const response = await getSilverResponse(senderID, user.name, user, userMessage);

    return api.sendMessage(response, threadID, (err, info) => {
        if (err) return;
        // ملاحظة: إذا كان المتغير العام في البوت الخاص بك يحمل اسماً آخر (مثل Silver.client)، قم بتعديل Mirror.client
        Mirror.client.HakimReply.push({
            name: this.config.title,
            messageID: info.messageID,
            author: senderID
        });
    }, messageID);
};

module.exports.config = {
    title: "سيلفر",
    release: "3.5.0",
    clearance: 0,
    author: "Hakim Tracks",
    summary: "تحدث مع سيلفر القنفذ (ذكاء اصطناعي)",
    section: "زكـــــــاء",
    syntax: "silver [رسالتك]",    delay: 2,
};
