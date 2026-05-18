module.exports = (s,config,lang) => {
    const {
        yesNoPossibility,
    } = require('./fieldValues.js')(s,config,lang);
    return {
        "section": "Sub-Account Manager",
        "blocks": {
            "Sub-Accounts": {
               "name": lang['Sub-Accounts'],
               "color": "orange",
               "isSection": true,
               "id":"monSectionAccountList",
               "info": [
                   {
                       "fieldType": "div",
                       "style": "max-height: 400px;overflow: auto;",
                       id: "subAccountsList",
                   }
               ]
            },
            // "Currently Active": {
            //    "name": lang['Currently Active'],
            //    "section-pre-class": "col-md-6 search-parent",
            //    "color": "green",
            //    "isSection": true,
            //    "info": [
            //        {
            //           "field": lang['Search'],
            //           "class": 'search-controller',
            //        },
            //        {
            //            "fieldType": "div",
            //            "class": "search-body",
            //            "id": "currently-active-users",
            //            "attribute": `style="max-height: 400px;overflow: auto;"`,
            //        }
            //    ]
            // },
            "Account Information": {
               "name": lang['Account Information'],
               "color": "blue",
               "isSection": true,
               "isForm": true,
               "id":"monSectionAccountInformation",
               "info": [
                   {
                       hidden: true,
                      "name": "uid",
                      "field": "UID",
                      "fieldType": "text"
                   },
                   {
                      "name": "mail",
                      "field": lang.Email,
                      "fieldType": "text",
                      "default": "",
                      "possible": ""
                   },
                   {
                      "name": "pass",
                      "field": lang.Password,
                      "fieldType": "password",
                      "default": "",
                      "possible": ""
                   },
                   {
                      "name": "password_again",
                      "field": lang['Password Again'],
                      "fieldType": "password",
                      "default": "",
                      "possible": ""
                   },
                   {
                       forForm: true,
                      "fieldType": "btn",
                      "attribute": `type="reset"`,
                      "class": `btn-default reset-form`,
                      "btnContent": `<i class="fa fa-undo"></i> &nbsp; ${lang['Clear']}`,
                   },
                   {
                      "fieldType": "btn",
                      "class": `btn-success submit-form`,
                      "btnContent": `<i class="fa fa-plus"></i> &nbsp; ${lang['Add New']}`,
                   },
                   {
                       hidden: true,
                      "name": "details",
                      "preFill": "{}",
                   },
               ]
           },
           "Account Privileges": {
              "name": lang['Account Privileges'],
              "color": "red",
              "isSection": true,
              "id":"monSectionAccountPrivileges",
              "info": [
                  {
                     "name": "detail=permissionSet",
                     "field": lang['Permission Group'],
                     "default": "",
                     "description": lang.fieldTextPermissionGroup,
                     "fieldType": "select",
                     "selector": "h_perm_permissionSet",
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
                     "name": "detail=allmonitors",
                     "field": lang['All Monitors and Privileges'],
                     "default": "0",
                     "fieldType": "select",
                     "selector": "h_perm_allmonitors",
                     "possible": yesNoPossibility
                  },
                  {
                     "name": "detail=monitor_create",
                     "field": lang['Can Create and Delete Monitors'],
                     "default": "0",
                     "fieldType": "select",
                     "possible": yesNoPossibility
                  },
                  {
                     "name": "detail=user_change",
                     "field": lang['Can Change User Settings'],
                     "default": "0",
                     "fieldType": "select",
                     "possible": yesNoPossibility
                  },
                  {
                     "name": "detail=view_logs",
                     "field": lang['Can View Logs'],
                     "default": "0",
                     "fieldType": "select",
                     "possible": yesNoPossibility
                  },
                  {
                     "name": "detail=edit_permissions",
                     "field": lang['Can Edit Permissions'],
                     "default": "0",
                     "fieldType": "select",
                     "possible": yesNoPossibility
                  }
              ]
           },
           "Monitors": {
              noHeader: true,
              "section-class": "search-parent h_perm_allmonitors_input h_perm_allmonitors_1",
              "color": "green",
              "info": [
                 {
                     "field": lang.Monitors,
                     "placeholder": lang.Search,
                     "class": "search-controller",
                 },
                 {
                     "fieldType": "btn",
                     "class": `btn-success submit-form`,
                     "btnContent": `<i class="fa fa-plus"></i> &nbsp; ${lang['Add New']}`,
                 },
                 {
                     "fieldType": "table",
                     "class": "search-body",
                     id: "sub_accounts_permissions",
                 },
             ]
          },
       }
   }
}
