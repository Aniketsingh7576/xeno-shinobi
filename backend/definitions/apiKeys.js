module.exports = (s,config,lang) => {
    const {
        yesNoPossibility,
    } = require('./fieldValues.js')(s,config,lang);
    return {
        "section": "API Keys",
        "blocks": {
            "API Keys": {
               "name": lang['API Keys'],
               "color": "blue",
               "isSection": true,
               "id":"apiKeySectionList",
               "info": [
                   {
                       "fieldType": "div",
                       "attribute": `style="max-height: 600px;overflow-y: auto;overflow-x: hidden;"`,
                       "id": "api_list",
                   }
               ]
            },
            "Add New": {
               "name": `<span class="title">${lang['Add New']}</span>`,
               "color": "forestgreen",
               "isSection": true,
               "isForm": true,
               "id":"apiKeySectionAddNew",
               "info": [
                   {
                       hidden: true,
                      "name": "code",
                      "fieldType": "text"
                   },
                   {
                      "name": "ip",
                      "field": lang['Allowed IPs'],
                      "default": `0.0.0.0`,
                      "placeholder": `0.0.0.0 ${lang['for Global Access']}`,
                      "description": lang[lang["fieldTextIp"]],
                      "fieldType": "text"
                   },
                   {
                      "name": "detail=treatAsSub",
                      "field": lang['Treated as Sub-Account'],
                      "default": "0",
                      "fieldType": "select",
                      "selector": "h_apiKey_treatAsSub",
                      "notForSubAccount": true,
                      "possible": yesNoPossibility,
                   },
                   {
                      "name": "detail=permissionSet",
                      "field": lang['Permission Group'],
                      "default": "",
                      "description": lang.fieldTextPermissionGroup,
                      "fieldType": "select",
                      // "notForSubAccount": true,
                      "possible": [
                          {
                             "name": lang.Default,
                             "value": "",
                             "info": lang.Default
                          },
                          {
                              "name": lang['Saved Permissions'],
                              "optgroup": []
                          }
                      ]
                   },
                   {
                      "id": "apiKey_permissions",
                      "field": lang['Permissions'],
                      "default": "",
                      "fieldType": "select",
                      "attribute": `multiple style="height:150px;"`,
                      "possible": [
                          {
                              name: lang['Can Authenticate Websocket'],
                              value: 'auth_socket',
                          },
                          {
                              name: lang['Can Create API Keys'],
                              value: 'create_api_keys',
                          },
                          {
                              name: lang['Can Change User Settings'],
                              value: 'edit_user',
                          },
                          {
                              name: lang['Can Edit Permissions'],
                              value: 'edit_permissions',
                          },
                          {
                              name: lang['Can Get Monitors'],
                              value: 'get_monitors',
                          },
                          {
                              name: lang['Can Edit Monitors'],
                              value: 'edit_monitors',
                          },
                          {
                              name: lang['Can Control Monitors'],
                              value: 'control_monitors',
                          },
                          {
                              name: lang['Can Get Logs'],
                              value: 'get_logs',
                          },
                          {
                              name: lang['Can View Streams'],
                              value: 'watch_stream',
                          },
                          {
                              name: lang['Can View Snapshots'],
                              value: 'watch_snapshot',
                          },
                          {
                              name: lang['Can View Videos'],
                              value: 'watch_videos',
                          },
                          {
                              name: lang['Can Delete Videos'],
                              value: 'delete_videos',
                          },
                          {
                              name: lang['Can View Alarms'],
                              value: 'get_alarms',
                          },
                          {
                              name: lang['Can Edit Alarms'],
                              value: 'edit_alarms',
                          },
                      ]
                   },
                   {
                      "name": "detail=monitorsRestricted",
                      "field": lang['Restricted Monitors'],
                      "default": "0",
                      "fieldType": "select",
                      "selector": "h_apiKey_monitorsRestricted",
                      // "notForSubAccount": true,
                      "possible": yesNoPossibility,
                   },
                   // {
                   //    "forForm": true,
                   //    "fieldType": "btn",
                   //    "class": `btn-success`,
                   //    "attribute": `type="submit"`,
                   //    "btnContent": `<i class="fa fa-plus"></i> &nbsp; ${lang['Add New']}`,
                   // },
                   // {
                   //    "forForm": true,
                   //    "fieldType": "btn",
                   //    "class": `btn-primary reset-form`,
                   //    "attribute": `type="button"`,
                   //    "btnContent": `<i class="fa fa-refresh"></i> &nbsp; ${lang['Clear']}`,
                   // },
               ]
           },
            "Monitors": {
              noHeader: true,
              styles: "display:none;",
              "section-class": "search-parent h_apiKey_monitorsRestricted_input h_apiKey_monitorsRestricted_1",
              "color": "green",
              "info": [
                 {
                     "field": lang.Monitors,
                     "placeholder": lang.Search,
                     "class": "search-controller",
                 },
                 {
                     "fieldType": "table",
                     "class": "search-body",
                     id: "apiKeys_monitors",
                 },
              ]
           },
        }
    }
}
