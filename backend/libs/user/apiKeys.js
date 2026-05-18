module.exports = function(s,config,lang){
    const availablePermissions = [
        { name: lang['Can Authenticate Websocket'], value: 'auth_socket' },
        { name: lang['Can Get Monitors'], value: 'get_monitors' },
        { name: lang['Can Edit Monitors'], value: 'edit_monitors' },
        { name: lang['Can Control Monitors'], value: 'control_monitors' },
        { name: lang['Can Get Logs'], value: 'get_logs' },
        { name: lang['Can View Streams'], value: 'watch_stream' },
        { name: lang['Can View Snapshots'], value: 'watch_snapshot' },
        { name: lang['Can View Videos'], value: 'watch_videos' },
        { name: lang['Can Delete Videos'], value: 'delete_videos' },
        { name: lang['Can View Alarm'], value: 'get_alarms' },
        { name: lang['Can Edit Alarm'], value: 'edit_alarms' },
    ]
    function createFullAccessDetails(){
        const details = {}
        for(item of availablePermissions){
            details[item.value] = '1'
        }
        return details
    }
    async function getApiKeys({ ke, uid }){
        const whereQuery = {
            ke,
        };
        if(uid)whereQuery.uid = uid;
        const { rows } = await s.knexQueryPromise({
            action: "select",
            columns: "*",
            table: "API",
            where: whereQuery
        });
        for(row of rows){
            row.details = JSON.parse(row.details);
        }
        return rows
    }
    async function getApiKey({ ke, code, uid }){
        const whereQuery = {
            ke,
            code
        };
        if(uid)whereQuery.uid = uid;
        const { rows } = await s.knexQueryPromise({
            action: "select",
            columns: "*",
            table: "API",
            where: whereQuery
        });
        if(rows[0])rows[0].details = JSON.parse(rows[0].details);
        return rows[0]
    }
    async function getNewApiKey(ke){
        let newApiKey = s.gid(30)
        const foundRow = await getApiKey({ ke, code: newApiKey })
        if(foundRow){
            return await getNewApiKey(ke)
        }else{
            return newApiKey
        }
    }
    async function createApiKey({ ke, uid, ip = '0.0.0.0', details = createFullAccessDetails() }){
        const newApiKey = await getNewApiKey(ke);
        const insertQuery = {
            ke,
            uid,
            code: newApiKey,
            ip,
            details: s.stringJSON(details)
        };
        await s.knexQueryPromise({
            action: "insert",
            table: "API",
            insert: insertQuery
        })
        return insertQuery;
    }
    async function updateApiKey({ ke, code, ip, details }){
        const whereQuery = {
            ke,
            code,
        };
        const updateQuery = {};
        if(ip)updateQuery.ip = ip;
        if(details)updateQuery.details = details;
        if(ip || details){
            await s.knexQueryPromise({
                action: "update",
                table: "API",
                where: whereQuery,
                update: updateQuery
            })
        }
        return { ke, code };
    }
    async function editApiKey({ ke, code, uid, ip, details }){
        const response = { ok: true }
        try{
            let exists = false;
            if(code){
                const row = await getApiKey({ ke, code, uid, ip, details });
                exists = !!row;
            }
            if(!exists){
                response.editResponse = await createApiKey({ ke, uid, ip, details })
            }else{
                response.editResponse = await updateApiKey({ ke, code, uid, ip, details })
                delete(s.api[response.editResponse.code])
            }
            response.api = await getApiKey({ ke, code: response.editResponse.code });
        }catch(err){
            response.ok = false;
            response.err = err.toString();
        }
        return response;
    }
    async function deleteApiKey({ ke, code, uid }){
        const whereQuery = {
            ke,
            code
        };
        if(uid)whereQuery.uid = uid;
        return await s.knexQueryPromise({
            action: "delete",
            table: "API",
            where: whereQuery
        })
    }
    return {
        availablePermissions,
        createFullAccessDetails,
        getApiKey,
        getApiKeys,
        getNewApiKey,
        createApiKey,
        updateApiKey,
        editApiKey,
        deleteApiKey,
    }
}
