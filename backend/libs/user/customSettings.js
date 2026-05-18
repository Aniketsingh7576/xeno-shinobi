module.exports = function(s,config,lang){
    async function getCustomSetting({ ke, uid, name }){
        const whereQuery = {
            ke,
        };
        if(uid)whereQuery.uid = uid;
        if(name)whereQuery.name = name;
        const { rows } = await s.knexQueryPromise({
            action: "select",
            columns: "*",
            table: "Custom Settings",
            where: whereQuery
        });
        for(row of rows){
            row.details = JSON.parse(row.details)
        }
        return rows
    }
    async function addCustomSetting({ ke, uid, name, details = {}, time = new Date() }){
        return await s.knexQueryPromise({
            action: "insert",
            table: "Custom Settings",
            insert: {
                ke,
                uid,
                name,
                details: s.stringJSON(details),
                time: new Date(),
            }
        })
    }
    async function updateCustomSetting({ ke, uid, name, details = {} }){
        return await s.knexQueryPromise({
            action: "update",
            table: "Custom Settings",
            where: {
                ke,
                uid,
                name,
            },
            update: {
                details: s.stringJSON(details),
                time: new Date(),
            }
        })
    }
    async function editCustomSetting({ ke, uid, name, details = {} }){
        const response = { ok: true }
        try{
            if(typeof details !== 'object'){
                details = {}
            }
            const existAlready = await getCustomSetting({ ke, uid, name });
            if(existAlready[0]){
                response.editResponse = await updateCustomSetting({ ke, uid, name, details })
            }else{
                response.editResponse = await addCustomSetting({ ke, uid, name, details })
            }
        }catch(err){
            response.ok = false;
            response.err = err.toString();
        }
        return response
    }
    async function deleteCustomSetting({ ke, uid, name }){
        return await s.knexQueryPromise({
            action: "delete",
            table: "Custom Settings",
            where: {
                ke,
                uid,
                name
            }
        })
    }
    return {
        getCustomSetting,
        addCustomSetting,
        updateCustomSetting,
        editCustomSetting,
        deleteCustomSetting,
    }
}
