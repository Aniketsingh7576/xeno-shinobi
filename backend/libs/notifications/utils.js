module.exports = (s,config,lang) => {
    function parseMessageOptions(data){
        const senderName = data.senderName || config.applicationName || lang.applicationName || lang.Xenocipher;
        const recipientAddress = data.recipientAddress;
        const title = data.title || data.text;
        const text = data.text;
        const monitorId = data.id || data.mid;
        const details = data.details;
        const footer = data.footer || data.subtitle;
        const time = data.time || new Date();
        return {
            senderName,
            recipientAddress,
            title,
            text,
            footer,
            time,
            monitorId,
            details,
        }
    }
    return {
        parseMessageOptions
    }
}
