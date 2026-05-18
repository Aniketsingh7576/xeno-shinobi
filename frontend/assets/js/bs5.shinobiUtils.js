class XenocipherUtils {
    constructor() {
    }

    buildApiPrefix(...args){
        return getApiPrefix(...args)
    }

    getList(target, param = 'list', defaultVal = []){
        const _this = this
        return new Promise((resolve) => {
            $.get(getApiPrefix(target), {timestamp: `${new Date()}`},function(data){
                var theList = data[param] || defaultVal;
                resolve(theList)
            }).fail((err) => {
                console.error(err)
                setTimeout(async () => {
                    resolve(await _this.getList(target, param, defaultVal))
                }, 2000)
            });
        })
    }

    parseUploaders(uploaderFields) {
        function getFieldValue(endsWith, uploadFields){
            const sectionFields = uploadFields.info
            return $user.details[sectionFields.find(item => {
                return item.name && item.name.endsWith(endsWith)
            }).name.replace('detail=','')]
        }
        const uploaders = {}
        uploaderFields.info.forEach((uploadFields) => {
            if(uploadFields.simpleUploader)return;
            const saveEnabled = getFieldValue('_save', uploadFields) === '1';
            const storageManagementEnabled = getFieldValue('_log', uploadFields) === '1';
            const humanName = uploadFields.name;
            const uploaderId = uploadFields.uploaderId || uploadFields.info[0].selector.replace('autosave_', '');
            uploaders[uploaderId] = {
                humanName,
                enabled: saveEnabled && storageManagementEnabled,
            };
        })
        return uploaders
    }

    async getUploaders() {
        const uploaderFields = await this.getList('uploaderFields', 'fields')
        const uploaders = this.parseUploaders(uploaderFields)
        return uploaders
    }
}
