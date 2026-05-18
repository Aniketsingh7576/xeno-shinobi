module.exports = function(s,config,lang){
    const yesNoPossibility = [
        { "name": lang.No, "value": "0" },
        { "name": lang.Yes, "value": "1" }
    ];
    const baseItems = [
        { name: "allmonitors", label: lang['All Monitors and Privileges'], possible: yesNoPossibility },
        { name: "monitor_create", label: lang['Can Create and Delete Monitors'], possible: yesNoPossibility },
        { name: "user_change", label: lang['Can Change User Settings'], possible: yesNoPossibility },
        { name: "view_logs", label: lang['Can View Logs'], possible: yesNoPossibility },
        { name: "edit_permissions", label: lang['Can Edit Permissions'], possible: yesNoPossibility },
    ];
    const monitorSpecific = [
        { name: 'monitors', label: lang['Can View Monitor'] },
        { name: 'monitor_edit', label: lang['Can Edit Monitor'] },
        { name: 'video_view', label: lang['Can View Videos and Events'] },
        { name: 'video_delete', label: lang['Can Delete Videos and Events'] },
    ];
    async function getPermissionSets(groupKey, name){
        const whereQuery = [
            ['ke','=',groupKey],
        ];
        if(name)whereQuery.push(['name','=',name]);
        const { rows } = await s.knexQueryPromise({
            action: "select",
            columns: "*",
            table: "Permission Sets",
            where: whereQuery
        });
        rows.forEach((row) => {
            row.details = s.parseJSON(row.details);
        });
        return rows
    }
    async function insertPermissionSet(groupKey, { name, details }){
        const insertResponse = await s.knexQueryPromise({
            action: "insert",
            table: "Permission Sets",
            insert: {
                ke: groupKey,
                name: name,
                details: s.stringJSON(details),
            }
        });
        return insertResponse
    }
    async function updatePermissionSet(groupKey, { name, details }){
        const updateResponse = await s.knexQueryPromise({
            action: "update",
            table: "Permission Sets",
            where: [
                ['ke','=', groupKey],
                ['name','=', name],
            ],
            update: {
                details: s.stringJSON(details),
            }
        });
        return updateResponse
    }
    async function deletePermissionSet(groupKey, name){
        const deleteResponse = await s.knexQueryPromise({
            action: "delete",
            table: "Permission Sets",
            where: [
                ['ke','=', groupKey],
                ['name','=', name],
            ]
        });
        return deleteResponse
    }
    async function editPermissionSet(groupKey, { name, details }){
        const response = { ok: true }
        try{
            const rows = await getPermissionSets(groupKey, name);
            const exists = !!rows[0];
            if(!exists){
                response.editResponse = await insertPermissionSet(groupKey, { name, details })
            }else{
                response.editResponse = await updatePermissionSet(groupKey, { name, details })
            }
        }catch(err){
            response.ok = false;
            response.err = err.toString();
        }
        return response;
    }
    async function applyPermissionsToUser(user){
        const groupKey = user.ke;
        const name = (user.details.permissionSet || '').trim();
        const apiKeyPermissions = user.permissions || {};
        if(name){
            const rows = await getPermissionSets(groupKey, name)
            const foundRow = rows[0];
            if(foundRow){
                user.details = Object.assign(user.details, foundRow.details)
            }
        }
        if(apiKeyPermissions.monitorsRestricted === '1' && apiKeyPermissions.monitorPermissions){
            user.details = Object.assign(user.details, apiKeyPermissions.monitorPermissions)
        }
        return user
    }
    return {
        getPermissionSets,
        insertPermissionSet,
        updatePermissionSet,
        deletePermissionSet,
        editPermissionSet,
        applyPermissionsToUser,
    }
}
