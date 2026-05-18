module.exports = function(jsonData,onConnected,onError,onClose){
    const config = jsonData.globalInfo.config;
    const dataPortToken = jsonData.dataPortToken;
    const CWS = require('cws');
    const client = new CWS(`ws://localhost:${config.port}/dataPort`);
    if(onError)client.on('error',onError);
    if(onClose)client.on('close',onClose);
    client.on('open',onConnected);
    return client;
}
