module.exports = function(s,config,lang){
    const acceptableOperators = ['>=','>','<','<=','=']
    function sanitizeOperator(startOrEndOperator = ''){
        const theOperator = `${startOrEndOperator}`.trim()
        if(!theOperator || acceptableOperators.indexOf(theOperator) === -1){
            return undefined
        }else{
            return theOperator
        }
    }
    async function getAlarm({ ke, mid, name, status, editedBy, time, start, startOperator = '>=', end, endOperator = '<=', limit }){
        const whereQuery = [
            ['ke','=',ke],
        ];
        if(mid)whereQuery.push(['mid','=',mid]);
        if(name)whereQuery.push(['name','=',name]);
        if(status !== undefined && status !== null)whereQuery.push(['status','=',status]);
        if(editedBy)whereQuery.push(['editedBy','=',editedBy]);
        if(time || start)whereQuery.push(['time',startOperator,time || start]);
        if(end)whereQuery.push(['end',endOperator,end]);
        const { rows } = await s.knexQueryPromise({
            action: "select",
            columns: "*",
            table: "Alarms",
            orderBy: ['time','desc'],
            where: whereQuery,
            limit
        });
        for(row of rows){
            row.details = JSON.parse(row.details);
            row.videos = JSON.parse(row.videos || '{}');
        }
        return rows
    }
    function getAlarmParams({ mid, name, videos, videoTime, notes, status, editedBy, details, time, start, end }, isForUpdate){
        const params = {};
        if(isForUpdate && details)params.details = s.stringJSON(details || {});
        if(isForUpdate && videos)params.videos = s.stringJSON(videos || {});
        if(mid)params.mid = mid;
        if(name)params.name = name;
        if(videoTime)params.videoTime = videoTime;
        if(notes)params.notes = notes;
        if(status !== undefined && status !== null)params.status = status;
        if(editedBy)params.editedBy = editedBy;
        if(start)params.time = start;
        if(time)params.time = time;
        if(end)params.end = end;
        return params
    }
    async function createAlarm({ ke, mid, name, videos, videoTime, notes, status, editedBy, details = {}, time, end }){
        const insertQuery = {
            ke,
        };
        const alarmParams = getAlarmParams({ ke, mid, name, videos, videoTime, notes, status, editedBy, details, time, end });
        for(param in alarmParams){
            insertQuery[param] = alarmParams[param]
        }
        await s.knexQueryPromise({
            action: "insert",
            table: "Alarms",
            insert: insertQuery
        })
        return insertQuery;
    }
    async function updateAlarm({ ke, mid, name, videos, videoTime, notes, status, editedBy, details, time, start, end }){
        const whereQuery = {
            ke,
            mid,
            time: time || start,
        };
        const updateQuery = getAlarmParams({ ke, name, videos, videoTime, notes, status, editedBy, details, end }, true);
        const response = { ok: true }
        try{
            if(Object.keys(updateQuery).length > 0){
                await s.knexQueryPromise({
                    action: "update",
                    table: "Alarms",
                    where: whereQuery,
                    update: updateQuery
                })
            }
        }catch(err){
            response.ok = false;
            response.err = err.toString();
        }
        return response;
    }
    async function deleteAlarm({ ke, mid, start }){
        const whereQuery = {
            ke,
            mid,
            time,
        };
        return await s.knexQueryPromise({
            action: "delete",
            table: "Alarms",
            where: whereQuery
        })
    }
    return {
        getAlarm,
        createAlarm,
        updateAlarm,
        deleteAlarm,
        sanitizeOperator,
    }
}
