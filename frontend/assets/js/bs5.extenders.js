const on = {};
const dashboardExtensions = {};
async function addExtender(extenderContainer){
    dashboardExtensions[extenderContainer] = [];
    on[extenderContainer] = function(...extender){
        dashboardExtensions[extenderContainer].push(...extender)
    };
}
async function addActionToExtender(extenderContainer, action){
    return on[extenderContainer](action)
}
async function executeExtender(extenderContainer, args = []){
    for(extender of dashboardExtensions[extenderContainer]){
        await extender(...args)
    }
}
function removeEventFromHandler(extenderContainer, functionName){
    if(dashboardExtensions[extenderContainer]){
        dashboardExtensions[extenderContainer]
        const index = dashboardExtensions[extenderContainer].findIndex(fn => typeof fn === 'function' && fn.name === functionName);
        if (index > -1) {
            dashboardExtensions[extenderContainer].splice(index, 1);
        }
    }
}
window.executeEventHandlers = executeExtender
window.createEventHandler = addExtender
var accountSettings = {
    onLoadFieldsExtensions: [],
    onLoadFields: function(...extender){
        accountSettings.onLoadFieldsExtensions.push(...extender)
    },
    onSaveFieldsExtensions: [],
    onSaveFields: function(...extender){
        accountSettings.onSaveFieldsExtensions.push(...extender)
    },
}
var onToggleSideBarMenuHideExtensions = [];
function onToggleSideBarMenuHide(...extender){
    onToggleSideBarMenuHideExtensions.push(...extender)
}
addExtender('windowBlur')
addExtender('windowFocus')
