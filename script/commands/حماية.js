// ==============================
// نظام حماية متكامل للمجموعات
// الإصدار 31.1.0 (مُصحَّح)
// ==============================

const fs = require("fs-extra");
const path = require("path");

// ==============================
// المطور المحمي
// ==============================

const protectedOwners = [
    "61575517356350"
];

// ==============================
// الملفات
// ==============================

const protectPath = path.join(
    __dirname,
    "cache",
    "protections.json"
);

const backupPath = path.join(
    __dirname,
    "cache",
    "protections-backup.json"
);

// ==============================
// إنشاء الملفات
// ==============================

if (!fs.existsSync(path.dirname(protectPath))) {

    fs.mkdirSync(
        path.dirname(protectPath),
        { recursive: true }
    );
}

if (!fs.existsSync(protectPath)) {

    fs.writeJsonSync(
        protectPath,
        {},
        { spaces: 2 }
    );
}

// ==============================
// كاش (في الذاكرة فقط - لا يُحفظ)
// ==============================

const cooldown = {};
const threadCache = {};

// [إصلاح 7] بيانات السبام في الذاكرة فقط وليس في DB
const spamMemory = {};

// ==============================
// قراءة قاعدة البيانات
// ==============================

function getDB() {

    try {

        return fs.readJsonSync(
            protectPath
        );

    } catch {

        fs.writeJsonSync(
            protectPath,
            {},
            { spaces: 2 }
        );

        return {};
    }
}

// ==============================
// حفظ قاعدة البيانات
// ==============================

function saveDB(data) {

    try {

        fs.writeJsonSync(
            protectPath,
            data,
            { spaces: 2 }
        );

    } catch (e) {

        // [إصلاح 10] استخدام console.error بدل console.log للأخطاء
        console.error("[حماية] خطأ في حفظ DB:", e);
    }
}

// ==============================
// Backup تلقائي
// ==============================

setInterval(() => {

    try {

        const data = getDB();

        fs.writeJsonSync(
            backupPath,
            data,
            { spaces: 2 }
        );

        // [إصلاح 9] حذف رسالة الكونسول المتكررة كل 10 دقائق

    } catch (e) {

        console.error("[حماية] Backup Error:", e);
    }

}, 1000 * 60 * 10);

// ==============================
// [إصلاح 7] تنظيف threadCache دورياً كل 5 دقائق
// ==============================

setInterval(() => {

    const now = Date.now();

    for (const id of Object.keys(threadCache)) {

        if (now - threadCache[id].time > 60000) {

            delete threadCache[id];
        }
    }

}, 1000 * 60 * 5);

// ==============================
// منع التكرار
// ==============================

function antiSpam(uid, type) {

    if (!uid || !type) {

        return false;
    }

    const key =
        `${uid}_${type}`;

    if (cooldown[key]) {

        return true;
    }

    cooldown[key] = true;

    setTimeout(() => {

        delete cooldown[key];

    }, 3000);

    return false;
}

// ==============================
// كاش معلومات المجموعة
// [إصلاح 5] رفع مدة الكاش من 15 إلى 45 ثانية
// ==============================

async function getThread(
    api,
    threadID
) {

    try {

        if (
            threadCache[threadID] &&
            Date.now() -
                threadCache[threadID].time <
                45000
        ) {

            return threadCache[
                threadID
            ].data;
        }

        const info =
            await api.getThreadInfo(
                threadID
            );

        threadCache[threadID] = {

            data: info,
            time: Date.now()
        };

        return info;

    } catch {

        return null;
    }
}

// ==============================
// طرد آمن
// ==============================

async function safeRemove(
    api,
    uid,
    threadID
) {

    try {

        if (
            String(uid) ===
            String(api.getCurrentUserID())
        ) {

            return;
        }

        if (
            protectedOwners.includes(
                String(uid)
            )
        ) {

            return;
        }

        await api.removeUserFromGroup(
            uid,
            threadID
        );

    } catch {}
}

// ==============================
// تشغيل / إيقاف
// ==============================

function light(v) {

    return v ? "🟢" : "🔴";
}

// ==============================
// أنواع الحماية
// ==============================

const list = {

    1: "photo",
    2: "name",
    3: "add",
    4: "admin",
    5: "nickname",
    6: "leave",
    7: "bot",
    8: "link",
    9: "spam",
    10: "mention",
    11: "emoji",
    12: "color"
};

// ==============================
// السجلات
// ==============================

function addLog(
    db,
    threadID,
    text
) {

    db[threadID].logs ??= [];

    db[threadID].logs.push({

        text,
        time: Date.now()
    });

    if (
        db[threadID].logs.length >
        100
    ) {

        db[threadID].logs.shift();
    }
}

// ==============================
// التحذيرات
// ==============================

function addWarn(
    db,
    threadID,
    uid
) {

    db[threadID].warns ??= {};

    db[threadID].warns[uid] ??= 0;

    db[threadID].warns[uid]++;

    return db[threadID].warns[uid];
}

// ==============================
// تصفير التحذيرات
// ==============================

function resetWarn(
    db,
    threadID,
    uid
) {

    db[threadID].warns ??= {};

    db[threadID].warns[uid] = 0;
}

// ==============================
// القائمة البيضاء
// ==============================

function isWhiteListed(
    db,
    threadID,
    uid
) {

    return (
        db[threadID]?.whitelist?.includes(
            String(uid)
        )
    );
}

// ==============================
// حفظ الكنيات
// ==============================

function saveNickname(
    db,
    threadID,
    uid,
    nickname
) {

    db[threadID].nicknames ??= {};

    db[threadID].nicknames[uid] =
        nickname || "";
}

// ==============================
// رسائل المخالفات
// ==============================

const protectMessages = {

    "تغيير الصورة":
    "يا أخي البخيل ما فعلت صورتنا لك إذا لم تعجبك اسكت و إلا ضربت لك ال🗿🗿🗿",

    "تغيير الاسم":
    "ما مشكلتك أيها الفاشل حتى تغير الإسم 🗿💔 هل أكلتك الدودة ؟؟",

    "إضافة الأعضاء":
    "ليس متاحا لك يا عضو فأنت عضو 🫵",

    "التلاعب بالمشرفين":
    "يا أخي رفقا بهم هل تخطط لغدرهم😏",

    "تغيير الكنية":
    "تبا لك و لتفكيرك يا شحات خذلك بانكاي في حنانك🗿💔",

    "المغادرة":
    "إلى أين تظن نفسك ذاهبا 😌 أنت معنا مدى الحياة",

    "إضافة بوت":
    "انت مشكوك بك 🫵 هل أنت روبوت ؟",

    "إرسال الروابط":
    "الروابط نحن من نضعها لا أنت يا فاشل تحب الروابط حطها في الخاص و لا تلوثنا هنا🙂",

    "السبام":
    "يا أخي ما تحس أنك زودتها خذلك هذه الهدية على إنجازك 🕳",

    "المنشن الجماعي":
    "لماذا تريدهم أصلا ؟؟ هم لا يريدونك 🤣🤣",

    "تغيير الإيموجي":
    "يا أخي حتى الإيموجي و لعبتوا فيه أيضا ؟ ايش الدودة هذي؟",

    "تغيير اللون":
    "من طلب رأيك في تغييره أصلا ؟ فذوقك مريع في الإختيار 😐💔"
};

// ==============================
// العقوبات
// ==============================

async function punish(
    api,
    db,
    threadID,
    uid,
    reason
) {

    if (
        protectedOwners.includes(
            String(uid)
        )
    ) {

        return;
    }

    const warns =
        addWarn(
            db,
            threadID,
            uid
        );

    addLog(
        db,
        threadID,
        `${reason} بواسطة ${uid}`
    );

    saveDB(db);

    const customText =
        protectMessages[reason] ||
        "⚠️ تم رصد مخالفة";

    // ==============================
    // الطرد بعد التحذير الثاني
    // ==============================

    if (warns >= 2) {

        await api.sendMessage(
`${customText}

❌ تم طرد العضو تلقائياً
⚠️ عدد التحذيرات: ${warns}/2`,
            threadID
        );

        await safeRemove(
            api,
            uid,
            threadID
        );

        resetWarn(
            db,
            threadID,
            uid
        );

    } else {

        await api.sendMessage(
`${customText}

⚠️ التحذير: ${warns}/2`,
            threadID
        );
    }
}

// ==============================
// معلومات الأمر
// ==============================

module.exports.config = {

    title: "حماية",
    release: "31.1.0",
    clearance: 1,
    author: "Hakim Tracks",
    summary: "نظام حماية متكامل للمجموعات",
    section: "الادمــــن",
    syntax:
        "حماية [1-12]",
    delay: 3
};

// ==============================
// أمر الحماية
// ==============================

module.exports.HakimRun = async function ({
    api,
    event,
    args
}) {

    try {

        const {
            threadID,
            senderID,
            messageID
        } = event;

        const info =
            await getThread(
                api,
                threadID
            );

        if (!info) {

            return;
        }

        const isAdmin =
            info.adminIDs.some(
                x =>
                    String(x.id) ===
                    String(senderID)
            );

        const isProtectedOwner =
            protectedOwners.includes(
                String(senderID)
            );

        if (
            !isAdmin &&
            !isProtectedOwner
        ) {

            return api.sendMessage(
                "❌ الأمر للمشرفين فقط",
                threadID,
                messageID
            );
        }

        const db = getDB();

        if (!db[threadID]) {

            db[threadID] = {

                enabled: {

                    photo: false,
                    name: false,
                    add: false,
                    admin: false,
                    nickname: false,
                    leave: false,
                    bot: false,
                    link: false,
                    spam: false,
                    mention: false,
                    emoji: false,
                    color: false
                },

                warns: {},
                logs: [],
                whitelist: [],
                nicknames: {},

                oldName:
                    info.threadName ||
                    "Group",

                oldEmoji:
                    info.emoji || "👍",

                oldColor:
                    info.threadTheme?.id ||
                    null,

                oldImage:
                    info.imageSrc || null
            };

            saveDB(db);
        }

        const enabled =
            db[threadID].enabled;

        // ==============================
        // القائمة
        // ==============================

        if (!args[0]) {

            return api.sendMessage(
`『 نظام الحماية 31 』

${light(enabled.photo)} 1- حماية الصورة
${light(enabled.name)} 2- حماية الاسم
${light(enabled.add)} 3- حماية الاضافة
${light(enabled.admin)} 4- حماية الادمن
${light(enabled.nickname)} 5- حماية الكنية
${light(enabled.leave)} 6- حماية المغادرة
${light(enabled.bot)} 7- حماية البوتات
${light(enabled.link)} 8- حماية الروابط
${light(enabled.spam)} 9- حماية السبام
${light(enabled.mention)} 10- حماية المنشن
${light(enabled.emoji)} 11- حماية الايموجي
${light(enabled.color)} 12- حماية اللون

✦ أوامر إضافية:

حماية سماح [uid]
حماية منع [uid]
حماية سجل
حماية مسح
حماية تحذيرات [uid]
حماية فك [uid]

✦ مثال:
حماية 1 3 8`,
                threadID,
                messageID
            );
        }

        // ==============================
        // مسح السجل
        // ==============================

        if (
            args[0] === "مسح"
        ) {

            db[threadID].logs = [];

            saveDB(db);

            return api.sendMessage(
                "✅ تم مسح السجل",
                threadID,
                messageID
            );
        }

        // ==============================
        // عدد التحذيرات
        // ==============================

        if (
            args[0] === "تحذيرات"
        ) {

            const uid =
                args[1];

            if (!uid) {

                return api.sendMessage(
                    "❌ اكتب uid",
                    threadID,
                    messageID
                );
            }

            const warns =
                db[threadID]
                    ?.warns?.[uid] || 0;

            return api.sendMessage(
                `⚠️ عدد التحذيرات: ${warns}`,
                threadID,
                messageID
            );
        }

        // ==============================
        // فك التحذيرات
        // ==============================

        if (
            args[0] === "فك"
        ) {

            const uid =
                args[1];

            if (!uid) {

                return api.sendMessage(
                    "❌ اكتب uid",
                    threadID,
                    messageID
                );
            }

            resetWarn(
                db,
                threadID,
                uid
            );

            saveDB(db);

            return api.sendMessage(
                "✅ تم فك التحذيرات",
                threadID,
                messageID
            );
        }

        // ==============================
        // السجل
        // ==============================

        if (
            args[0] === "سجل"
        ) {

            const logs =
                db[threadID].logs || [];

            if (!logs.length) {

                return api.sendMessage(
                    "❌ لا يوجد سجل",
                    threadID,
                    messageID
                );
            }

            const text = logs
                .slice(-15)
                .map(
                    (x, i) =>
                        `${i + 1}- ${x.text}`
                )
                .join("\n");

            return api.sendMessage(
                text,
                threadID,
                messageID
            );
        }

        // ==============================
        // القائمة البيضاء - سماح
        // [إصلاح 6] إضافة فحص uid قبل الإضافة
        // ==============================

        if (
            args[0] === "سماح"
        ) {

            const uid = args[1];

            if (!uid) {

                return api.sendMessage(
                    "❌ اكتب uid العضو",
                    threadID,
                    messageID
                );
            }

            db[threadID]
                .whitelist ??= [];

            if (
                !db[threadID]
                    .whitelist
                    .includes(String(uid))
            ) {

                db[threadID]
                    .whitelist
                    .push(String(uid));

                saveDB(db);
            }

            return api.sendMessage(
                "✅ تمت إضافة العضو للسماح",
                threadID,
                messageID
            );
        }

        // ==============================
        // إزالة السماح
        // ==============================

        if (
            args[0] === "منع"
        ) {

            const uid = args[1];

            if (!uid) {

                return api.sendMessage(
                    "❌ اكتب uid العضو",
                    threadID,
                    messageID
                );
            }

            db[threadID].whitelist =
                (
                    db[threadID]
                        .whitelist || []
                ).filter(
                    x =>
                        String(x) !==
                        String(uid)
                );

            saveDB(db);

            return api.sendMessage(
                "✅ تمت إزالة العضو من السماح",
                threadID,
                messageID
            );
        }

        // ==============================
        // تشغيل الحمايات
        // ==============================

        const nums = args
            .map(x => parseInt(x))
            .filter(x => list[x]);

        if (!nums.length) {

            return api.sendMessage(
                "❌ اختر أرقام صحيحة",
                threadID,
                messageID
            );
        }

        for (const num of nums) {

            const key =
                list[num];

            enabled[key] =
                !enabled[key];
        }

        saveDB(db);

        return api.sendMessage(
            "✅ تم تحديث الحمايات",
            threadID,
            messageID
        );

    } catch (e) {

        console.error("[حماية] خطأ في HakimRun:", e);
    }
};

// ==============================
// نظام الأحداث
// ==============================

module.exports.HakimEvent = async function ({
    api,
    event
}) {

    try {

        const {
            threadID,
            senderID,
            body,
            mentions,
            logMessageType,
            logMessageData,
            author
        } = event;

        if (!threadID) {

            return;
        }

        const db = getDB();

        if (!db[threadID]) {

            return;
        }

        const settings =
            db[threadID].enabled;

        // ==============================
        // الرسائل النصية
        // ==============================

        if (
            body &&
            senderID
        ) {

            if (
                isWhiteListed(
                    db,
                    threadID,
                    senderID
                )
            ) {

                return;
            }

            if (
                protectedOwners.includes(
                    String(senderID)
                )
            ) {

                return;
            }

            // حماية الروابط

            if (
                settings.link &&
                /(https?:\/\/|www\.|\.com|\.net|\.org)/i.test(
                    body
                )
            ) {

                await punish(
                    api,
                    db,
                    threadID,
                    senderID,
                    "إرسال الروابط"
                );
            }

            // حماية المنشن

            if (
                settings.mention &&
                mentions &&
                Object.keys(
                    mentions
                ).length >= 5
            ) {

                await punish(
                    api,
                    db,
                    threadID,
                    senderID,
                    "المنشن الجماعي"
                );
            }

            // ==============================
            // حماية السبام
            // [إصلاح 4] بيانات السبام في الذاكرة فقط وليس في DB
            // ==============================

            if (settings.spam) {

                const key =
                    `${threadID}_${senderID}`;

                spamMemory[key] ??= {
                    count: 0,
                    time: Date.now()
                };

                const spam =
                    spamMemory[key];

                if (
                    Date.now() -
                        spam.time <
                    5000
                ) {

                    spam.count++;

                } else {

                    spam.count = 1;
                }

                spam.time =
                    Date.now();

                if (spam.count >= 5) {

                    spam.count = 0;

                    await punish(
                        api,
                        db,
                        threadID,
                        senderID,
                        "السبام"
                    );
                }
            }
        }

        // ==============================
        // أحداث المجموعة
        // ==============================

        if (
            String(author) ===
            String(api.getCurrentUserID())
        ) {

            return;
        }

        if (
            protectedOwners.includes(
                String(author)
            ) &&
            logMessageType !== "log:unsubscribe"
        ) {

            return;
        }

        if (
            author &&
            antiSpam(
                author,
                logMessageType
            )
        ) {

            return;
        }

        const freshThread =
            await getThread(
                api,
                threadID
            );

        if (!freshThread) {

            return;
        }

        if (
            isWhiteListed(
                db,
                threadID,
                author
            )
        ) {

            return;
        }

        const authorIsAdmin =
            freshThread.adminIDs.some(
                x =>
                    String(x.id) ===
                    String(author)
            );

        // ==============================
        // حفظ الكنيات الأصلية
        // ==============================

        if (
            freshThread.nicknames
        ) {

            Object.keys(
                freshThread.nicknames
            ).forEach(uid => {

                saveNickname(
                    db,
                    threadID,
                    uid,
                    freshThread.nicknames[
                        uid
                    ]
                );
            });

            saveDB(db);
        }

        // ==============================
        // حماية الصورة
        // ==============================

        if (
            logMessageType ===
                "log:thread-image" &&
            settings.photo &&
            !authorIsAdmin
        ) {

            try {

                if (
                    db[threadID]
                        .oldImage
                ) {

                    await api.changeGroupImage(
                        db[threadID]
                            .oldImage,
                        threadID
                    );
                }

            } catch {}

            await punish(
                api,
                db,
                threadID,
                author,
                "تغيير الصورة"
            );

            return;
        }

        // ==============================
        // حماية الاسم
        // ==============================

        if (
            logMessageType ===
                "log:thread-name" &&
            settings.name &&
            !authorIsAdmin
        ) {

            try {

                await api.setTitle(
                    db[threadID]
                        .oldName ||
                        "Group",
                    threadID
                );

            } catch {}

            await punish(
                api,
                db,
                threadID,
                author,
                "تغيير الاسم"
            );

            return;
        }

        // ==============================
        // حماية الإضافة + البوتات
        // [إصلاح 1] دمج الحمايتين في بلوك واحد لأنهما يشتركان في نفس الحدث
        // ==============================

        if (logMessageType === "log:subscribe") {

            const added =
                logMessageData
                    ?.addedParticipants || [];

            // --- حماية البوتات أولاً (لا تحتاج فحص الأدمن) ---

            if (settings.bot) {

                const botNames = [
                    "bot",
                    "بوت",
                    "chatbot",
                    "gpt",
                    "openai"
                ];

                let botPunished = false;

                for (const user of added) {

                    const uid =
                        user.userFbId;

                    const name =
                        (
                            user.fullName || ""
                        ).toLowerCase();

                    const isBot =
                        botNames.some(
                            x =>
                                name.includes(x)
                        );

                    if (isBot) {

                        await safeRemove(
                            api,
                            uid,
                            threadID
                        );

                        botPunished = true;
                    }
                }

                // عقوبة واحدة فقط على من أضاف البوت
                if (botPunished) {

                    await punish(
                        api,
                        db,
                        threadID,
                        author,
                        "إضافة بوت"
                    );

                    return;
                }
            }

            // --- حماية الإضافة (للأعضاء غير الأدمن) ---

            if (
                settings.add &&
                !authorIsAdmin &&
                !protectedOwners.includes(
                    String(author)
                )
            ) {

                for (const user of added) {

                    await safeRemove(
                        api,
                        user.userFbId,
                        threadID
                    );
                }

                await punish(
                    api,
                    db,
                    threadID,
                    author,
                    "إضافة الأعضاء"
                );

                return;
            }
        }

        // ==============================
        // حماية الأدمن
        // ==============================

        if (
            logMessageType ===
                "log:thread-admins" &&
            settings.admin &&
            !authorIsAdmin
        ) {

            const target =
                logMessageData
                    ?.TARGET_ID;

            const action =
                logMessageData
                    ?.ADMIN_EVENT;

            try {

                if (
                    action ===
                    "remove_admin"
                ) {

                    await api.changeAdminStatus(
                        threadID,
                        target,
                        true
                    );
                }

                if (
                    action ===
                    "add_admin"
                ) {

                    await api.changeAdminStatus(
                        threadID,
                        target,
                        false
                    );
                }

            } catch {}

            await punish(
                api,
                db,
                threadID,
                author,
                "التلاعب بالمشرفين"
            );

            return;
        }

        // ==============================
        // حماية الكنية
        // ==============================

        if (
            logMessageType ===
                "log:user-nickname" &&
            settings.nickname &&
            !authorIsAdmin
        ) {

            const target =
                logMessageData
                    ?.participant_id;

            const oldNick =
                db[threadID]
                    ?.nicknames?.[
                    target
                ] || "";

            try {

                await api.changeNickname(
                    oldNick,
                    threadID,
                    target
                );

            } catch {}

            await punish(
                api,
                db,
                threadID,
                author,
                "تغيير الكنية"
            );

            return;
        }

        // ==============================
        // حماية المغادرة
        // [إصلاح 2] إضافة فحص authorIsAdmin لمنع إرجاع الأدمن قسراً
        // [إصلاح 8] دمج الرسالتين في رسالة واحدة
        // ==============================

        if (
            logMessageType ===
                "log:unsubscribe" &&
            settings.leave
        ) {

            const leftID =
                logMessageData
                    ?.leftParticipantFbId;

            const selfLeave =
                String(leftID) ===
                String(author);

            // إرجاع كل من غادر بنفسه بدون استثناء
            if (selfLeave) {

                try {

                    await api.addUserToGroup(
                        leftID,
                        threadID
                    );

                    // [إصلاح 8] رسالة واحدة بدل اثنتين
                    await api.sendMessage(
                        "♻️ تم إرجاع العضو تلقائياً\nإلى أين تظن نفسك ذاهبا 😌 أنت معنا مدى الحياة",
                        threadID
                    );

                } catch {

                    await api.sendMessage(
                        "❌ فشل إرجاع العضو، تأكد أن البوت أدمن",
                        threadID
                    );
                }
            }

            return;
        }

        // ==============================
        // حماية الإيموجي
        // ==============================

        if (
            logMessageType ===
                "log:thread-icon" &&
            settings.emoji &&
            !authorIsAdmin
        ) {

            try {

                await api.changeThreadEmoji(
                    db[threadID]
                        .oldEmoji || "👍",
                    threadID
                );

            } catch {}

            await punish(
                api,
                db,
                threadID,
                author,
                "تغيير الإيموجي"
            );

            return;
        }

        // ==============================
        // حماية اللون
        // ==============================

        if (
            logMessageType ===
                "log:thread-color" &&
            settings.color &&
            !authorIsAdmin
        ) {

            try {

                if (
                    db[threadID]
                        .oldColor
                ) {

                    await api.changeThreadColor(
                        db[threadID]
                            .oldColor,
                        threadID
                    );
                }

            } catch {}

            await punish(
                api,
                db,
                threadID,
                author,
                "تغيير اللون"
            );

            return;
        }

    } catch (err) {

        console.error("[حماية] خطأ في HakimEvent:", err);
    }
};
