module.exports = (s,config,lang) => {
    const {
        yesNoPossibility,
    } = require('./fieldValues.js')(s,config,lang);
    return {
        "section": "Region Editor",
        "blocks": {
            "Regions": {
                "color": "green",
                isFormGroupGroup: true,
                "noHeader": true,
                "section-class": "col-md-6",
                "noDefaultSectionClasses": true,
                "info": [
                    {
                       "name": lang["Regions"],
                       "headerTitle": `<span class="cord_name">&nbsp;</span>
                         <div class="pull-right">
                             <a href=# class="btn btn-success btn-sm add"><i class="fa fa-plus"></i></a>
                             <a href=# class="btn btn-danger btn-sm erase"><i class="fa fa-trash-o"></i></a>
                         </div>`,
                       "color": "orange",
                       "box-wrapper-class": "row",
                       isFormGroupGroup: true,
                       "info": [
                           {
                              "field": lang["Monitor"],
                              "id": "region_editor_monitors",
                              "fieldType": "select",
                              "form-group-class": "col-md-6",
                           },
                           {
                              "id": "regions_list",
                              "field": lang["Regions"],
                              "fieldType": "select",
                              "possible": [],
                              "form-group-class": "col-md-6",
                          },
                           {
                              "name": "name",
                              "field": lang['Region Name'],
                           },
                           {
                              "name": "sensitivity",
                              "field": lang['Minimum Change'],
                              "form-group-class": "col-md-6",
                           },
                           {
                              "name": "max_sensitivity",
                              "field": lang['Maximum Change'],
                              "form-group-class": "col-md-6",
                           },
                           {
                              "name": "threshold",
                              "field": lang['Trigger Threshold'],
                              "form-group-class": "col-md-6",
                           },
                           {
                              "name": "color_threshold",
                              "field": lang['Color Threshold'],
                              "form-group-class": "col-md-6",
                           },
                           {
                               hidden: true,
                               id: "regions_points",
                               "fieldType": "table",
                               "class": 'table table-striped',
                           },
                           {
                               "class": 'col-md-12',
                               "fieldType": 'div',
                               info: [
                                   {
                                      "fieldType": "btn",
                                      attribute: "href=#",
                                      "class": `btn-info toggle-region-still-image`,
                                      "btnContent": `<i class="fa fa-retweet"></i> &nbsp; ${lang['Live Stream Toggle']}`,
                                   },
                                   {
                                      "fieldType": "btn",
                                      forForm: true,
                                      attribute: "href=#",
                                      "class": `btn-success`,
                                      "btnContent": `<i class="fa fa-check"></i> &nbsp; ${lang['Save']}`,
                                   },
                               ]
                           },
                       ]
                   },
                   {
                      "name": lang["Primary"],
                      "color": "blue",
                      "section-class": "hide-box-wrapper",
                      "box-wrapper-class": "row",
                      isFormGroupGroup: true,
                      "info": [
                          {
                             "name": "detail=detector_sensitivity",
                             "field": lang['Minimum Change'],
                             "description": "The motion confidence rating must exceed this value to be seen as a trigger. This number correlates directly to the confidence rating returned by the motion detector. This option was previously named \"Indifference\".",
                             "default": "10",
                             "example": "10",
                          },
                          {
                             "name": "detail=detector_max_sensitivity",
                             "field": lang["Maximum Change"],
                             "description": "The motion confidence rating must be lower than this value to be seen as a trigger. Leave blank for no maximum. This option was previously named \"Max Indifference\".",
                             "default": "",
                             "example": "75",
                          },
                          {
                             "name": "detail=detector_threshold",
                             "field": lang["Trigger Threshold"],
                             "description": lang["fieldTextDetectorThreshold"],
                             "default": "1",
                             "example": "3",
                             "possible": "Any non-negative integer."
                          },
                          {
                             "name": "detail=detector_color_threshold",
                             "field": lang["Color Threshold"],
                             "description": lang["fieldTextDetectorColorThreshold"],
                             "default": "9",
                             "example": "9",
                             "possible": "Any non-negative integer."
                          },
                          {
                             "name": "detail=detector_frame",
                             "field": lang["Full Frame Detection"],
                             "description": lang["fieldTextDetectorFrame"],
                             "default": "1",
                             "fieldType": "select",
                             "possible": yesNoPossibility
                          },
                          {
                             "name": "detail=detector_motion_tile_mode",
                             "field": lang['Accuracy Mode'],
                             "default": "1",
                             "example": "",
                             "fieldType": "select",
                             "possible": yesNoPossibility
                          },
                          {
                             "name": "detail=detector_tile_size",
                             "field": lang["Tile Size"],
                             "description": lang.fieldTextTileSize,
                             "default": "20",
                          },
                          {
                             "name": "detail=use_detector_filters",
                             "field": lang['Event Filters'],
                             "description": lang.fieldTextEventFilters,
                             "default": "0",
                             "fieldType": "select",
                             "possible": yesNoPossibility
                          },
                          {
                             "name": "detail=use_detector_filters_object",
                             "field": lang['Filter for Objects only'],
                             "default": "0",
                             "fieldType": "select",
                             "possible": yesNoPossibility
                          },
                      ]
                  },
               ]
           },
           "Points": {
              "name": lang["Points"],
              "color": "orange",
              "section-pre-class": "col-md-6",
              "style": "overflow:auto",
              "blockquoteClass": "global_tip",
              "blockquote": lang.RegionNote,
              "info": [
                  {
                      "fieldType": "div",
                      class: "canvas_holder",
                      divContent: `<div id="region_editor_live"><iframe></iframe><img></div>
                      <div class="grid"></div><textarea id="regions_canvas" rows=3 class="hidden canvas-area input-xxlarge" disabled></textarea>`,
                  }
              ]
           }
        }
    }
}
