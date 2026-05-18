module.exports = (s,config,lang) => {
    const {
        yesNoPossibility,
    } = require('./fieldValues.js')(s,config,lang);
    return {
       "section": "Monitor Settings",
       "blocks": {
           "Page Control": {
              name: lang.Monitor,
              headerTitle: `<div id="tab-monitorSettings-title">${lang['Monitor Settings']} : <span>Add New</span></div>`,
             "color": "blue",
              isSection: false,
             "info": [
                 {
                     "field": lang.Monitor,
                     "fieldType": "select",
                     "class": "monitors_list",
                     "possible": [
                         {
                            "name": lang['Add New'],
                            "value": ""
                         },
                         {
                            "name": lang.Saved,
                            "optgroup": []
                         },
                     ]
                 },
                 {
                    "fieldType": "btn",
                    "class": `btn-success reset-monitor-settings-form`,
                    "btnContent": `<i class="fa fa-refresh"></i> &nbsp; ${lang['Reset Form']}`,
                 },
             ]
          },
          "Identity": {
             "name": lang.Identity,
             "color": "grey",
             "isSection": true,
             "id":"monSectionIdentity",
             "blockquoteClass": "global_tip",
             "blockquote": `<div class="am_notice am_notice_new">${lang.IdentityText1}</div><div class="am_notice am_notice_edit">${lang.IdentityText2}</div>`,
             "info": [
                {
                   "name": "mode",
                   "field": lang.Mode,
                   "fieldType": "select",
                   "description": lang["fieldTextMode"],
                   "default": "start",
                   "example": "",
                   "selector": "h_m",
                   "possible": [
                      {
                         "name": lang.Disabled,
                         "value": "stop",
                         "info": lang["fieldTextModeDisabled"]
                      },
                      {
                         "name": lang["Watch-Only"],
                         "value": "start",
                         "info": lang["fieldTextModeWatchOnly"]
                      },
                      {
                         "name": lang.Record,
                         "value": "record",
                         "info": lang["fieldTextModeRecord"]
                      },
                      {
                         "name": lang.Idle,
                         "value": "idle",
                         "info": ""
                      }
                   ]
                },
                {
                   "name": "mid",
                   "field": lang["Monitor ID"],
                   "description": lang["fieldTextMid"],
                   "example": s.gid()
                },
                {
                   "name": "name",
                   "field": lang.Name,
                   "description": lang["fieldTextName"],
                   "example": "Home-Front"
                },
                {
                   "name": "tags",
                   "field": lang['Tags'],
                   "description": lang.tagsFieldText,
                },
                {
                   "name": "detail=max_keep_days",
                   "field": lang["Number of Days to keep"] + ' ' + lang['Videos'],
                   "placeholder": "Default is Global value.",
                   "description": lang["fieldTextMaxKeepDays"],
                },
                {
                   "name": "detail=notes",
                   "field": lang.Notes,
                   "description": lang["fieldTextNotes"],
                   "fieldType": "textarea",
                },
                {
                   "name": "detail=dir",
                   "field": lang["Storage Location"],
                   "description": lang["fieldTextDir"],
                   "fieldType": "select",
                   "possible": s.listOfStorage
               },
               {
                  "name": "detail=ptz_id",
                  "field": lang["PTZ Control ID"],
                  "example": "1",
                  "description": lang["ptzControlIdFieldText"],
               },
               {
                  "name": "detail=auto_compress_videos",
                  "field": lang['Compress Completed Videos'],
                  "description": lang.compressCompletedVideosFieldText,
                  "fieldType": "select",
                  "possible": yesNoPossibility
              },
              {
                 "name": "detail=geolocation",
                 "field": lang["Geolocation"],
                 "example": "49.2578298,-123.2634732",
                 "description": lang["fieldTextGeolocation"],
              },
              {
                  "id": "monitor-settings-monitor-map-container",
                  "style": "position: relative",
                  "fieldType": "div",
                  divContent: `
                  <div id="monitor-settings-geolocation-options" class="p-2" style="background: rgba(0,0,0,0.4);position: absolute; top: 0; right: 0; border-radius: 0 0 0 15px; z-index: 405;">
                      <label for="direction">${lang.Direction} <span class="badge" map-option-value="direction"></span></label>
                      <div class="slider-container">
                          <input type="range" map-option="direction" class="slider" min="0" max="360" value="90">
                      </div>
                      <label for="fov">${lang['Field of View']} <span class="badge"><span map-option-value="fov"></span>°</span></label>
                      <div class="slider-container">
                          <input type="range" map-option="fov" class="slider" min="0" max="180" value="60">
                      </div>
                      <label for="range">${lang.Range} <span class="badge"><span map-option-value="range"></span> km</span></label>
                      <div class="slider-container">
                          <input type="range" map-option="range" class="slider" min="0" max="10" value="1" step="0.1">
                      </div>
                  </div>
                  <div id="monitor-settings-monitor-map" style="width: 100%;height: 300px;border-radius:15px;"></div>`,
              },
             ]
          },
          "Connection": {
             "name": lang.Connection,
             "color": "orange",
             "id": "monSectionConnection",
             "isSection": true,
             "blockquote":`<p>${lang.InputText1}</p>\
             ${lang.InputText2}\
             <p>${lang.InputText3}</p>`,
             "blockquoteClass":"global_tip",
             "info": [
                 {
                    "name": "type",
                    "fieldType": "select",
                    "selector": "h_t",
                    "field": lang["Input Type"],
                    "description": lang["fieldTextType"],
                    "default": "h264",
                    "example": "",
                    "possible": [
                         {
                            "name": "JPEG",
                            "value": "jpeg",
                            "info": lang["fieldTextTypeJPEG"]
                         },
                         {
                            "name": "MJPEG",
                            "value": "mjpeg",
                            "info": lang["fieldTextTypeMJPEG"]
                         },
                         {
                            "name": "H.264 / H.265 / H.265+",
                            "value": "h264",
                            "info": lang["fieldTextTypeH.264/H.265/H.265+"]
                         },
                         {
                            "name": "HLS (.m3u8)",
                            "value": "hls",
                            "info": lang["fieldTextTypeHLS(.m3u8)"]
                         },
                         {
                            "name": "MPEG-4 (.mp4 / .ts)",
                            "value": "mp4",
                            "info": lang["fieldTextTypeMPEG4(.mp4/.ts)"]
                         },
                         {
                            "name": "Xenocipher Streamer",
                            "value": "socket",
                            "info": lang["fieldTextTypeXenocipherStreamer"]
                         },
                         {
                            "name": "Dashcam (Streamer v2)",
                            "value": "dashcam",
                            "info": lang["fieldTextTypeDashcam(StreamerV2)"]
                         },
                         {
                            "name": lang.Local,
                            "value": "local",
                            "info": lang["fieldTextTypeLocal"]
                         },
                         {
                            "evaluation": "!!config.rtmpServer",
                            "name": "RTMP",
                            "value": "rtmp",
                            "info": `Learn to connect here : <a href="https://shinobi.video/articles/2019-02-14-how-to-push-streams-to-shinobi-with-rtmp" target="_blank">Article : How to Push Streams via RTMP to Xenocipher</a>`
                         },
                         {
                            "name": "MxPEG",
                            "value": "mxpeg",
                            "info": lang["fieldTextTypeMxPEG"]
                         },
                      ]
                 },
                 {
                     hidden:true,
                    "name": "detail=rtmp_key",
                    "form-group-class": "h_t_input h_t_rtmp",
                    "field": lang['Stream Key'],
                    "description": lang["fieldTextRtmpKey"],
                    "default": "",
                    "example": "",
                    "possible": ""
                 },
                 {
                     hidden:true,
                    "name": "detail=auto_host_enable",
                    "field": lang.Automatic,
                    "description": lang["fieldTextAutoHostEnable"],
                    "selector": "h_auto_host",
                    "form-group-class": "h_t_input h_t_h264 h_t_hls h_t_mp4 h_t_jpeg h_t_mjpeg h_t_mxpeg",
                    "form-group-class-pre-layer":"h_t_input h_t_h264 h_t_hls h_t_mp4 h_t_jpeg h_t_mjpeg h_t_mxpeg h_t_local",
                    "default": "",
                    "example": "",
                    "fieldType": "select",
                    "possible": yesNoPossibility
                 },
                 {
                     hidden:true,
                    "name": "detail=auto_host",
                    "field": lang["Full URL Path"],
                    "form-group-class": "h_auto_host_input h_auto_host_1",
                    "description": lang["fieldTextAutoHost"],
                    "default": "",
                    "example": "rtsp://username:password@123.123.123.123/stream/1",
                    "possible": ""
                 },
                 {
                     hidden:true,
                    "name": "protocol",
                    "field": lang["Connection Type"],
                    "description": lang["fieldTextProtocol"],
                    "default": "RTSP",
                    "example": "",
                    "form-group-class": "h_t_input h_t_h264 h_t_hls h_t_mp4 h_t_jpeg h_t_mjpeg",
                    "form-group-class-pre-layer": "h_auto_host_input h_auto_host_0 auto_host_fill",
                    "fieldType": "select",
                    "possible": [
                        {
                           "name": "HTTP",
                           "value": "http"
                        },
                        {
                           "name": "HTTPS",
                           "value": "https"
                        },
                        {
                           "name": "RTSP",
                           "value": "rtsp"
                        },
                        {
                           "name": "SRT",
                           "value": "srt"
                        },
                        {
                           "name": "RTMP",
                           "value": "rtmp"
                        },
                        {
                           "name": "RTMPS",
                           "value": "rtmps"
                        },
                        {
                           "name": "UDP",
                           "value": "udp"
                        }
                     ]
                 },
                 {
                    "name": "detail=rtsp_transport",
                    "field": lang["RTSP Transport"],
                    "description": lang["fieldTextRtspTransport"],
                    "form-group-class": "h_t_input h_t_h264 h_t_hls h_t_mp4 h_t_jpeg h_t_mjpeg",
                    "form-group-class-pre-layer":"h_p_input h_p_rtsp",
                    "fieldType": "select",
                    "possible": [
                        {
                           "name": lang.Auto,
                           "value": "no",
                           "info": lang["fieldTextRtspTransportAuto"]
                        },
                        {
                           "name": "TCP",
                           "value": "tcp",
                           "info": lang["fieldTextRtspTransportTCP"]
                        },
                        {
                           "name": "UDP",
                           "value": "udp",
                           "info": lang["fieldTextRtspTransportUDP"]
                        },
                        {
                           "name": lang['UDP Multicast'],
                           "value": "udp_multicast",
                           "info": lang["fieldTextRtspTransportUDPMulticast"]
                        },
                        {
                           "name": "HTTP",
                           "value": "http",
                           "info": lang["fieldTextRtspTransportHTTP"]
                        }
                     ]
                 },
                 {
                     hidden:true,
                    "name": "detail=muser",
                    "field": lang.Username,
                    "description": lang["fieldTextMuser"],
                    "default": "",
                    "example": "kittenFinder",
                    "form-group-class": "h_t_input h_t_h264 h_t_hls h_t_mp4 h_t_jpeg h_t_mjpeg",
                    "form-group-class-pre-layer": "h_auto_host_input h_auto_host_0 auto_host_fill",
                    "possible": ""
                 },
                 {
                     hidden:true,
                    "name": "detail=mpass",
                    "fieldType": "password",
                    "field": lang.Password,
                    "description": lang["fieldTextMpass"],
                    "default": "",
                    "example": "kittenCuddler",
                    "form-group-class": "h_t_input h_t_h264 h_t_hls h_t_mp4 h_t_jpeg h_t_mjpeg",
                    "form-group-class-pre-layer": "h_auto_host_input h_auto_host_0 auto_host_fill",
                    "possible": ""
                 },
                 {
                     hidden:true,
                    "name": "host",
                    "field": lang.Host,
                    "description": lang["fieldTextHost"],
                    "default": "",
                    "example": "111.111.111.111",
                    "form-group-class": "h_t_input h_t_h264 h_t_hls h_t_mp4 h_t_jpeg h_t_mjpeg",
                    "form-group-class-pre-layer": "h_auto_host_input h_auto_host_0 auto_host_fill",
                    "possible": ""
                 },
                 {
                     hidden:true,
                    "name": "port",
                    "field": lang.Port,
                    "description": lang["fieldTextPort"],
                    "default": "80",
                    "example": "554",
                    "possible": "1-65535",
                    "form-group-class": "h_t_input h_t_h264 h_t_hls h_t_mp4 h_t_jpeg h_t_mjpeg",
                    "form-group-class-pre-layer": "h_auto_host_input h_auto_host_0 auto_host_fill",
                 },
                 {
                     hidden:true,
                    "name": "detail=port_force",
                    "field": lang["Force Port"],
                    "description": lang["fieldTextPortForce"],
                    "default": "0",
                    "example": "",
                    "form-group-class": "h_t_input h_t_h264 h_t_hls h_t_mp4 h_t_jpeg h_t_mjpeg",
                    "form-group-class-pre-layer": "h_auto_host_input h_auto_host_0 auto_host_fill",
                    "fieldType": "select",
                    "possible": yesNoPossibility
                 },
                 {
                     hidden:true,
                    "name": "path",
                    "field": lang.Path,
                    "description": lang["fieldTextPath"],
                    "default": "",
                    "example": "/videostream.cgi?1",
                    "possible": "",
                    "form-group-class": "h_t_input h_t_h264 h_t_hls h_t_mp4 h_t_jpeg h_t_mjpeg h_t_local",
                    "form-group-class-pre-layer": "h_auto_host_input h_auto_host_0 auto_host_fill",
                 },
                 {
                    "name": "detail=fatal_max",
                    "field": lang['Retry Connection'],
                    "description": lang["fieldTextFatalMax"],
                    "example": "10",
                 },
                 {
                    "name": "detail=skip_ping",
                    "field": lang['Skip Ping'],
                    "description": lang["fieldTextSkipPing"],
                    "default": "0",
                    "example": "",
                    "fieldType": "select",
                    "possible": yesNoPossibility
                 },
                 {
                    "name": "detail=is_onvif",
                    "field": lang.ONVIF,
                    "description": lang["fieldTextIsOnvif"],
                    "default": "0",
                    "example": "",
                    "selector": "h_onvif",
                    "fieldType": "select",
                    "possible": yesNoPossibility
                 },
                 {
                     hidden: true,
                    "name": "detail=onvif_port",
                    "field": lang['ONVIF Port'],
                    "description": `ONVIF is usually run on port <code>8000</code>. This can be <code>80</code> as well depending on your camera model.`,
                    "default": "8000",
                    "example": "",
                    "form-group-class": "h_onvif_input h_onvif_1",
                 },
                 {
                    "fieldType": "btn",
                    "class": `btn-success probe_config`,
                    "btnContent": `<i class="fa fa-search"></i> &nbsp; ${lang.FFprobe}`,
                 },
                 {
                    "fieldType": "btn",
                    "attribute": `style="margin-top:1rem"`,
                    "form-group-class-pre-layer": "h_onvif_input h_onvif_1",
                    "class": `btn-warning am_notice_edit open-onvif-device-manager`,
                    "btnContent": `<i class="fa fa-gears"></i> &nbsp; ${lang['ONVIF Device Manager']}`,
                 },
             ]
         },
          "Input": {
             "name": lang.Input,
             "color": "forestgreen",
             "id": "monSectionInput",
             "isSection": true,
             "info": [
                {
                    hidden:true,
                   "name": "detail=primary_input",
                   "field": lang['Primary Input'],
                   "description": "",
                   "default": "0:0",
                   "example": "",
                   "fieldType": "select",
                   "form-group-class": "input-mapping",
                   "possible": [
                        {
                           "name": lang['All streams in first feed'] + ' (0, ' + lang.Default + ')',
                           "value": "0"
                        },
                        {
                           "name": lang['First stream in feed'] + ' (0:0)',
                           "value": "0:0"
                        },
                        {
                           "name": lang['Second stream in feed'] + " (0:1)",
                           "value": "0:1"
                        },
                        {
                           "name": lang['Video streams only'] + " (0:v)",
                           "value": "0:v"
                        },
                        {
                           "name": lang['Video stream only from first feed'] + " (0:v:0)",
                           "value": "0:v:0"
                        }
                     ]
                },
                {
                   "name": "detail=aduration",
                   "field": lang["Analyzation Duration"],
                   "description": lang["fieldTextAduration"],
                   "default": "",
                   "example": "100000",
                   "possible": ""
                },
                {
                   "name": "detail=probesize",
                   "field": lang["Probe Size"],
                   "description": lang["fieldTextProbesize"],
                   "default": "",
                   "example": "100000",
                   "possible": ""
                },
                {
                    hidden: true,
                   "name": "detail=stream_loop",
                   "field": lang['Loop Stream'],
                   "description": lang["fieldTextStreamLoop"],
                   "default": "1",
                   "example": "",
                   "form-group-class": "h_t_input h_t_mp4 h_t_local",
                   "fieldType": "select",
                   "possible": yesNoPossibility
                },
                {
                   "name": "detail=sfps",
                   "field": lang['Monitor Capture Rate'],
                   "description": lang["fieldTextSfps"],
                   "default": "",
                   "example": "25",
                   "possible": ""
                },
                {
                   "name": "detail=wall_clock_timestamp_ignore",
                   "field": lang['Use Camera Timestamps'],
                   "description": lang["fieldTextWallClockTimestampIgnore"],
                   "default": "0",
                   "example": "",
                   "form-group-class": "h_t_input h_t_h264",
                   "fieldType": "select",
                   "possible": yesNoPossibility
                },
                {
                    hidden: true,
                   "name": "height",
                   "field": lang["Height"],
                   "description": lang["fieldTextHeight"],
                   "default": "480",
                   "example": "720, 0 for Auto",
                   "possible": ""
                },
                {
                    hidden: true,
                   "name": "width",
                   "field": lang["Width"],
                   "description": lang["fieldTextWidth"],
                   "default": "640",
                   "example": "1280, 0 for Auto",
                   "possible": ""
                },
                {
                  "name": "detail=accelerator",
                  "field": lang.Accelerator,
                  "description": lang["fieldTextAccelerator"],
                  "default": "",
                  "example": "",
                  "selector": "h_gpud",
                  "fieldType": "select",
                  "possible": yesNoPossibility
                },
                {
                     "name": "detail=hwaccel",
                     "field": lang.hwaccel,
                     "description": lang["fieldTextHwaccel"],
                     "default": "",
                     "example": "",
                     "form-group-class": "h_gpud_input h_gpud_1",
                     "fieldType": "select",
                     "possible": s.listOfHwAccels
                 },
                {
                     "name": "detail=hwaccel_vcodec",
                     "field": lang.hwaccel_vcodec,
                     "description": lang["fieldTextHwaccelVcodec"],
                     "default": "",
                     "example": "",
                     "form-group-class": "h_gpud_input h_gpud_1",
                     "fieldType": "select",
                     "possible": [
                        {
                           "name": lang.Auto + '('+lang.Recommended+')',
                           "value": ""
                        },
                        {
                           "name": lang.NVIDIA,
                           "optgroup": [
                               {
                                  "name": lang.h264_cuvid,
                                  "value": "h264_cuvid"
                               },
                               {
                                  "name": lang.hevc_cuvid,
                                  "value": "hevc_cuvid"
                               },
                               {
                                  "name": lang.mjpeg_cuvid,
                                  "value": "mjpeg_cuvid"
                               },
                               {
                                  "name": lang.mpeg4_cuvid,
                                  "value": "mpeg4_cuvid"
                               },
                           ]
                        },
                        {
                           "name": lang["Quick Sync Video"],
                           "optgroup": [
                               {
                                  "name": lang.h264_qsv,
                                  "value": "h264_qsv"
                               },
                               {
                                  "name": lang.hevc_qsv,
                                  "value": "hevc_qsv"
                               },
                               {
                                  "name": lang.mpeg2_qsv,
                                  "value": "mpeg2_qsv"
                               },
                           ]
                        },
                        {
                           "name": lang['Raspberry Pi'],
                           "optgroup": [
                               {
                                  "name": lang.h264_mmal,
                                  "value": "h264_mmal"
                               },
                               {
                                  "name": lang.mpeg2_mmal,
                                  "value": "mpeg2_mmal"
                               },
                               {
                                  "name": lang["MPEG-4 (Raspberry Pi)"],
                                  "value": "mpeg4_mmal"
                               }
                           ]
                        },
                     ]
                 },
                 {
                      "name": "detail=hwaccel_device",
                      "field": lang.hwaccel_device,
                      "description": "",
                      "default": "",
                      "example": "",
                      "form-group-class": "h_gpud_input h_gpud_1",
                      "possible": ""
                  },
                 {
                      "name": "detail=hwaccel_format",
                      "field": lang.hwaccel_format,
                      "description": "Hardware Acceleration Format",
                      "default": "",
                      "example": "vaapi",
                      "form-group-class": "h_gpud_input h_gpud_1",
                      "possible": ""
                  },
             ]
          },
          "Input Maps": {
             "name": lang["Additional Inputs"],
             "color": "orange",
             "id": "monSectionInputMaps",
             "section-class": "pb-0",
             "emptyDiv": true
         },
          "Stream": {
             "name": lang.Stream,

             "color": "navy",
             "id": "monSectionStream",
             "isSection": true,
             "input-mapping": "stream",
             "blockquoteClass": "global_tip",
             "blockquote": lang.StreamText,
             "info": [
                {
                   "name": "detail=stream_type",
                   "field": lang["Stream Type"],
                   "description": lang["fieldTextStreamType"],
                   "default": "hls",
                   "selector": "h_st",
                   "fieldType": "select",
                   "attribute": `triggerChange="#add_monitor [detail=stream_vcodec]" triggerChangeIgnore="b64,mjpeg,jpeg,gif"`,
                   "possible": [
                        {
                           "name": lang.Poseidon,
                           "value": "mp4",
                           "info": lang["fieldTextStreamTypePoseidon"]
                        },
                        {
                           "name": lang['Base64 over Websocket'],
                           "value": "b64",
                           "info": lang["fieldTextStreamTypeBase64OverWebsocket"]
                        },
                        {
                           "name": lang['JPEG (Auto Enables JPEG API)'],
                           "value": "jpeg"
                        },
                        {
                           "name": lang['MJPEG'],
                           "value": "mjpeg",
                           "info": lang["fieldTextStreamTypeMJPEG"]
                        },
                        {
                           "name": lang['FLV'],
                           "value": "flv",
                           "info": lang["fieldTextStreamTypeFLV"]
                        },
                        {
                           "name": lang['HLS (includes Audio)'],
                           "value": "hls",
                           "info": lang["fieldTextStreamTypeHLS(includesAudio)"]
                       },
                        {
                           "name": lang.useSubStreamOnlyWhenWatching,
                           "value": "useSubstream",
                        }
                     ]
                },
                {
                    isAdvanced: true,
                    hidden:true,
                    "name": "detail=stream_flv_type",
                    "field": lang["Connection Type"],
                    "description": lang["fieldTextStreamFlvType"],
                    "default": "0",
                    "example": "",
                    "fieldType": "select",
                    "form-group-class": "h_st_input h_st_flv h_st_mp4",
                    "possible": [
                       {
                          "name": lang.HTTP,
                          "value": "http",
                       },
                       {
                          "name": lang.Websocket,
                          "value": "ws",
                       }
                    ]
                },
                {
                    isAdvanced: true,
                    hidden:true,
                   "name": "detail=stream_flv_maxLatency",
                   "field": lang["Max Latency"],
                   "description": "",
                   "default": "10",
                   "example": "20000",
                   "form-group-class": "h_st_lat_input h_st_lat_ws",
                   "form-group-class-pre-layer": "h_st_input h_st_mjpeg",
                   "possible": ""
                },
                {
                    isAdvanced: true,
                    hidden:true,
                   "name": "detail=stream_mjpeg_clients",
                   "field": lang["# of Allow MJPEG Clients"],
                   "description": "",
                   "default": "20",
                   "example": "",
                   "form-group-class": "h_st_input h_st_mjpeg",
                   "possible": ""
                },
                {
                   "name": "detail=stream_vcodec",
                   "field": lang['Video Codec'],
                   "description": lang["fieldTextStreamVcodec"],
                   "default": "copy",
                   "example": "",
                   "form-group-class": "h_st_input h_st_hls h_st_flv h_st_mp4",
                   "fieldType": "select",
                   "selector": "h_hls_v",
                   "possible": [
                      {
                         "name": lang.Auto,
                         "value": "no",
                         "info": lang["fieldTextStreamVcodecAuto"]
                      },
                      {
                         "name": "libx264",
                         "value": "libx264",
                         "info": lang["fieldTextStreamVcodecLibx264"]
                      },
                      {
                         "name": "libx265",
                         "value": "libx265",
                         "info": lang["fieldTextStreamVcodecLibx265"]
                      },
                      {
                         "name": lang.copy,
                         "value": "copy",
                         "info": lang["fieldTextStreamVcodecCopy"]
                      },
                      {
                          "name": lang['Hardware Accelerated'],
                          "optgroup": [
                              {
                                 "name": "H.264 VA-API (Intel HW Accel)",
                                 "value": "h264_vaapi"
                              },
                              {
                                 "name": "H.265 VA-API (Intel HW Accel)",
                                 "value": "hevc_vaapi"
                              },
                              {
                                 "name": "H.264 NVENC (NVIDIA HW Accel)",
                                 "value": "h264_nvenc"
                              },
                              {
                                 "name": "H.264 NVENC Jetson (NVIDIA HW Accel NVMPI)",
                                 "value": "h264_nvmpi"
                              },
                              {
                                 "name": "H.265 NVENC (NVIDIA HW Accel)",
                                 "value": "hevc_nvenc"
                              },
                              {
                                 "name": "H.264 (Quick Sync Video)",
                                 "value": "h264_qsv"
                              },
                              {
                                 "name": "H.265 (Quick Sync Video)",
                                 "value": "hevc_qsv"
                              },
                              {
                                 "name": "MPEG2 (Quick Sync Video)",
                                 "value": "mpeg2_qsv"
                              },
                              {
                                 "name": "H.264 (Quick Sync Video)",
                                 "value": "h264_qsv"
                              },
                              {
                                 "name": "H.265 (Quick Sync Video)",
                                 "value": "hevc_qsv"
                              },
                              {
                                 "name": "MPEG2 (Quick Sync Video)",
                                 "value": "mpeg2_qsv"
                              },
                              {
                                 "name": "H.264 openMAX (Raspberry Pi)",
                                 "value": "h264_omx"
                              }
                          ]
                      },
                   ]
                },
                {
                   "name": "detail=stream_acodec",
                   "field": lang["Audio Codec"],
                   "description": lang["fieldTextStreamAcodec"],
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "form-group-class": "h_st_input h_st_hls h_st_flv h_st_mp4",
                   "possible": [
                      {
                         "name": lang.Auto,
                         "info": lang["fieldTextStreamAcodecAuto"],
                         "value": ""
                      },
                      {
                         "name": lang["No Audio"],
                         "info": lang["fieldTextStreamAcodecNoAudio"],
                         "value": "no"
                      },
                      {
                         "name": "libvorbis",
                         "info": lang["fieldTextStreamAcodecLibvorbis"],
                         "value": "libvorbis"
                      },
                      {
                         "name": "libopus",
                         "info": lang["fieldTextStreamAcodecLibopus"],
                         "value": "libopus"
                      },
                      {
                         "name": "libmp3lame",
                         "info": lang["fieldTextStreamAcodecLibmp3lame"],
                         "value": "libmp3lame"
                      },
                      {
                         "name": "aac",
                         "info": lang["fieldTextStreamAcodecAac"],
                         "value": "aac"
                      },
                      {
                         "name": "ac3",
                         "info": lang["fieldTextStreamAcodecAc3"],
                         "value": "ac3"
                      },
                      {
                         "name": "copy",
                         "info": lang["fieldTextStreamAcodecCopy"],
                         "value": "copy"
                      }
                   ]
                },
                {
                    isAdvanced: true,
                   "name": "detail=hls_time",
                   "field": "HLS Segment Length",
                   "description": lang["fieldTextHlsTime"],
                   "default": "2",
                   "form-group-class": "h_st_input h_st_hls",
                },
                {
                    isAdvanced: true,
                   "name": "detail=hls_list_size",
                   "field": "HLS List Size",
                   "description": lang["fieldTextHlsListSize"],
                   "default": "2",
                   "form-group-class": "h_st_input h_st_hls",
                },
                {
                    isAdvanced: true,
                   "name": "detail=preset_stream",
                   "field": "HLS Preset",
                   "description": lang["fieldTextPresetStream"],
                   "example": "ultrafast",
                   "form-group-class": "h_st_input h_st_hls h_st_flv h_st_mp4",
                },
                {
                   "name": "detail=stream_quality",
                   "field": lang.Quality,
                   "description": lang["fieldTextStreamQuality"],
                   "default": "15",
                   "example": "1",
                   uiVisibilityConditions: 'streamSectionCopyModeVisibilities',
                   "possible": "1-23"
                },
                {
                   "name": "detail=stream_fps",
                   "field": lang['Frame Rate'],
                   "description": lang["fieldTextStreamFps"],
                   "default": "",
                   "example": "1",
                   uiVisibilityConditions: 'streamSectionCopyModeVisibilities',
                   "possible": ""
                },
                {
                   "name": "detail=stream_scale_x",
                   "field": lang.Width,
                   "description": lang["fieldTextStreamScaleX"],
                   "default": "",
                   "fieldType": "number",
                   "numberMin": "1",
                   "example": "640",
                   uiVisibilityConditions: 'streamSectionCopyModeVisibilities',
                   "possible": ""
                },
                {
                   "name": "detail=stream_scale_y",
                   "field": lang.Height,
                   "description": lang["fieldTextStreamScaleY"],
                   "default": "",
                   "fieldType": "number",
                   "numberMin": "1",
                   "example": "480",
                   uiVisibilityConditions: 'streamSectionCopyModeVisibilities',
                   "possible": ""
                },
                {
                   "name": "detail=stream_rotate",
                   "field": lang["Rotate"],
                   "description": lang["fieldTextStreamRotate"],
                   "default": "",
                   "example": "",
                   "fieldType": "select",
                   uiVisibilityConditions: 'streamSectionCopyModeVisibilities',
                   "possible": [
                        {
                           "name": lang["No Rotation"],
                           "value": "no"
                        },
                        {
                           "name": lang["180 Degrees"],
                           "value": "2,transpose=2"
                        },
                        {
                           "name": lang["90 Counter Clockwise and Vertical Flip (default)"],
                           "value": "0"
                        },
                        {
                           "name": lang["90 Clockwise"],
                           "value": "1"
                        },
                        {
                           "name": lang["90 Counter Clockwise"],
                           "value": "2"
                        },
                        {
                           "name": lang["90 Clockwise and Vertical Flip"],
                           "value": "3"
                        }
                     ]
                },
                {
                    isAdvanced: true,
                   "name": "detail=signal_check",
                   "field": lang["Check Signal Interval"],
                   "description": lang["fieldTextSignalCheck"],
                   "default": "0",
                   "example": "",
                   "possible": ""
                },
                {
                    isAdvanced: true,
                   "name": "detail=signal_check_log",
                   "field": lang["Log Signal Event"],
                   "description": lang["fieldTextSignalCheckLog"],
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "possible": yesNoPossibility
                },
                {
                    isAdvanced: true,
                   "name": "detail=stream_vf",
                   "field": lang["Video Filter"],
                   "description": lang["fieldTextStreamVf"],
                   "default": "",
                   "example": "",
                   uiVisibilityConditions: 'streamSectionCopyModeVisibilities',
                   "possible": ""
                },
                {
                    isAdvanced: true,
                   "name": "detail=tv_channel",
                   "field": lang["TV Channel"],
                   "description": lang["fieldTextTvChannel"],
                   "default": "",
                   "selector": "h_tvc",
                   "fieldType": "select",
                   "example": "",
                   "possible": yesNoPossibility
                },
                {
                    isAdvanced: true,
                   "name": "detail=tv_channel_id",
                   "field": lang["TV Channel ID"],
                   "description": lang["fieldTextTvChannelId"],
                   "default": "",
                   "example": "",
                   "form-group-class": "h_tvc_input h_tvc_1",
                   "possible": ""
                },
                {
                    isAdvanced: true,
                   "name": "detail=tv_channel_group_title",
                   "field": lang["TV Channel Group"],
                   "description": lang["fieldTextTvChannelGroupTitle"],
                   "default": "",
                   "example": "",
                   "form-group-class": "h_tvc_input h_tvc_1",
                   "possible": ""
                },
             ]
          },
          "Stream Timestamp": {
             "id": "monSectionStreamTimestamp",
             "name": lang["Stream Timestamp"],
             "color": "blue",
             isAdvanced: true,
             "section-class": "h_hls_v_input h_hls_v_libx264 h_hls_v_libx265 h_hls_v_h264_nvenc h_hls_v_hevc_nvenc h_hls_v_no",
             "isSection": true,
             "info": [
                 {
                    "name": "detail=stream_timestamp",
                    "selector":"h_stm",
                    "field": lang.Enabled,
                    "description": lang["fieldTextStreamTimestamp"],
                    "default": "0",
                    "example": "",
                    "fieldType": "select",
                    "possible": yesNoPossibility
                },
                {
                    hidden: true,
                   "name": "detail=stream_timestamp_font",
                   "field": "Font Path",
                   "description": lang["fieldTextStreamTimestampFont"],
                   "default": "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
                   "example": "",
                   "form-group-class": "h_stm_input h_stm_1",
                   "possible": ""
                },
                {
                    hidden: true,
                   "name": "detail=stream_timestamp_font_size",
                   "field": "Font Size",
                   "description": lang["fieldTextStreamTimestampFontSize"],
                   "default": "10",
                   "example": "",
                   "form-group-class": "h_stm_input h_stm_1",
                   "possible": ""
                },
                {
                    hidden: true,
                   "name": "detail=stream_timestamp_color",
                   "field": "Text Color",
                   "description": lang["fieldTextStreamTimestampColor"],
                   "default": "white",
                   "example": "",
                   "form-group-class": "h_stm_input h_stm_1",
                   "possible": ""
                },
                {
                    hidden: true,
                   "name": "detail=stream_timestamp_box_color",
                   "field": "Text Box Color",
                   "description": lang["fieldTextStreamTimestampBoxColor"],
                   "default": "0x00000000@1",
                   "example": "",
                   "form-group-class": "h_stm_input h_stm_1",
                   "possible": ""
                },
                {
                    hidden: true,
                   "name": "detail=stream_timestamp_x",
                   "field": "Position X",
                   "description": lang["fieldTextStreamTimestampX"],
                   "default": "(w-tw)/2",
                   "example": "",
                   "form-group-class": "h_stm_input h_stm_1",
                   "possible": ""
                },
                {
                    hidden: true,
                   "name": "detail=stream_timestamp_y",
                   "field": "Position Y",
                   "description": lang["fieldTextStreamTimestampY"],
                   "default": "0",
                   "example": "",
                   "form-group-class": "h_stm_input h_stm_1",
                   "possible": ""
                }
             ]
          },
          "Stream Watermark": {
             "id": "monSectionStreamWatermark",
             "name": lang['Stream Watermark'],
             "color": "blue",
             isAdvanced: true,
             "section-class": "h_hls_v_input h_hls_v_libx264 h_hls_v_libx265 h_hls_v_h264_nvenc h_hls_v_hevc_nvenc h_hls_v_no",
             "isSection": true,
             "info": [
                 {
                    "name": "detail=stream_watermark",
                    "field": lang.Enabled,
                    "description": lang["fieldTextStreamWatermark"],
                    "default": "0",
                    "example": "",
                    "fieldType": "select",
                    "selector": "h_wat",
                    "possible": yesNoPossibility
                },
                {
                    hidden: true,
                   "name": "detail=stream_watermark_location",
                   "field": lang['Image Location'],
                   "description": lang["fieldTextStreamWatermarkLocation"],
                   "default": "0",
                   "example": "/usr/share/watermark.logo",
                   "form-group-class": "h_wat_input h_wat_1",
                   "possible": ""
                },
                {
                    hidden: true,
                    "name": "detail=stream_watermark_position",
                    "field": lang['Image Position'],
                    "description": lang["fieldTextStreamWatermarkPosition"],
                    "default": "0",
                    "example": "",
                    "fieldType": "select",
                    "form-group-class": "h_wat_input h_wat_1",
                    "possible": [
                        {
                           "name": lang["Top Right"],
                           "value": "tr"
                        },
                        {
                           "name": lang["Top Left"],
                           "value": "tl"
                        },
                        {
                           "name": lang["Bottom Right"],
                           "value": "br"
                        },
                        {
                           "name": lang["Bottom Left"],
                           "value": "bl"
                        }
                     ]
                },
             ]
          },
          "Stream Channels": {
             "name": "Stream Channels",
             "color": "blue",
             "id": "monSectionStreamChannels",
             "section-class": "pb-0",
             "emptyDiv": true
         },
         "Substream": {
            "name": lang['Substream'],
            "color": "blue",
            "isSection": true,
            "id": "monSectionSubstream",
            "blockquote": lang.substreamText,
            "blockquoteClass": 'global_tip',
            "info": [
                {
                    isAdvanced: true,
                    "name": lang['Connection'],
                    "color": "orange",
                    id: "monSectionSubstreamInput",
                    "blockquote": lang.substreamConnectionText,
                    "blockquoteClass": 'global_tip',
                    isSection: true,
                    isFormGroupGroup: true,
                    "info": [
                        {
                            name:'detail-substream-input=type',
                            field:lang['Input Type'],
                            default:'h264',
                            attribute:'selector="h_i_SUBSTREAM_FIELDS"',
                            "fieldType": "select",
                            type:'selector',
                            possible:[
                              {
                                 "name": "H.264 / H.265 / H.265+",
                                 "value": "h264",
                                 selected: true,
                              },
                              {
                                 "name": "JPEG",
                                 "value": "jpeg"
                              },
                              {
                                 "name": "MJPEG",
                                 "value": "mjpeg"
                              },
                              {
                                 "name": "HLS (.m3u8)",
                                 "value": "hls"
                              },
                              {
                                 "name": "MPEG-4 (.mp4 / .ts)",
                                 "value": "mp4"
                              },
                              {
                                 "name": "Local",
                                 "value": "local"
                              },
                              {
                                 "name": "Raw",
                                 "value": "raw"
                              }
                           ]
                        },
                        {
                            name:'detail-substream-input=stream_flv_type',
                            field:lang['Loop Stream'],
                            class:'h_i_SUBSTREAM_FIELDS_input h_i_SUBSTREAM_FIELDS_mp4',
                            hidden:true,
                            default:'0',
                            "fieldType": "select",
                            type:'selector',
                            possible:[
                                {
                                   "name": lang.HTTP,
                                   "value": "http",
                                },
                                {
                                   "name": lang.Websocket,
                                   "value": "ws",
                                }
                            ]
                        },
                        {
                            name:'detail-substream-input=fulladdress',
                            field:lang['Full URL Path'],
                            placeholder:'Example : rtsp://admin:password@123.123.123.123/stream/1',
                            type:'text',
                        },
                        {
                            name:'detail-substream-input=sfps',
                            field:lang['Monitor Capture Rate'],
                            placeholder:'',
                            type:'text',
                        },
                        {
                            name:'detail-substream-input=aduration',
                            field:lang['Analyzation Duration'],
                            placeholder:'Example : 1000000',
                            type:'text',
                        },
                        {
                            name:'detail-substream-input=probesize',
                            field:lang['Probe Size'],
                            placeholder:'Example : 1000000',
                            type:'text',
                        },
                        {
                            name:'detail-substream-input=stream_loop',
                            field:lang['Loop Stream'],
                            class:'h_i_SUBSTREAM_FIELDS_input h_i_SUBSTREAM_FIELDS_mp4 h_i_SUBSTREAM_FIELDS_raw',
                            hidden:true,
                            default:'0',
                            "fieldType": "select",
                            type:'selector',
                            possible:[
                                {
                                   "name": lang.No,
                                   "value": "0",
                                },
                                {
                                   "name": lang.Yes,
                                   "value": "1",
                                   selected: true,
                                }
                            ]
                        },
                        {
                            name:'detail-substream-input=rtsp_transport',
                            field:lang['RTSP Transport'],
                            class:'h_i_SUBSTREAM_FIELDS_input h_i_SUBSTREAM_FIELDS_h264',
                            default:'',
                            "fieldType": "select",
                            type:'selector',
                            possible:[
                                {
                                   "name": lang.Auto,
                                   "value": "",
                                   "info": lang["fieldTextDetailSubstreamInputRtspTransportAuto"],
                                   selected: true,
                                },
                                {
                                   "name": "TCP",
                                   "value": "tcp",
                                   "info": lang["fieldTextDetailSubstreamInputRtspTransportTCP"]
                                },
                                {
                                   "name": "UDP",
                                   "value": "udp",
                                   "info": lang["fieldTextDetailSubstreamInputRtspTransportUDP"]
                                }
                            ]
                        },
                        {
                            name:'detail-substream-input=accelerator',
                            field:lang['Accelerator'],
                            attribute:'selector="h_accel_SUBSTREAM_FIELDS"',
                            default:'0',
                            "fieldType": "select",
                            type:'selector',
                            possible:[
                                {
                                   "name": lang.No,
                                   "value": "0",
                                   selected: true,
                                },
                                {
                                   "name": lang.Yes,
                                   "value": "1",
                                }
                            ]
                        },
                        {
                            name:'detail-substream-input=hwaccel',
                            field:lang['hwaccel'],
                            class:'h_accel_SUBSTREAM_FIELDS_input h_accel_SUBSTREAM_FIELDS_1',
                            hidden:true,
                            default:'',
                            "fieldType": "select",
                            type:'selector',
                            possible: s.listOfHwAccels
                        },
                        {
                            name:'detail-substream-input=hwaccel_vcodec',
                            field:lang['hwaccel_vcodec'],
                            class:'h_accel_SUBSTREAM_FIELDS_input h_accel_SUBSTREAM_FIELDS_1',
                            hidden:true,
                            default:'auto',
                            "fieldType": "select",
                            type:'selector',
                            possible:[
                                {
                                   "name": lang.Auto + '('+lang.Recommended+')',
                                   "value": "",
                                   selected: true,
                                },
                                {
                                   "name": lang.NVIDIA,
                                   "optgroup": [
                                       {
                                          "name": lang.h264_cuvid,
                                          "value": "h264_cuvid"
                                       },
                                       {
                                          "name": lang.hevc_cuvid,
                                          "value": "hevc_cuvid"
                                       },
                                       {
                                          "name": lang.mjpeg_cuvid,
                                          "value": "mjpeg_cuvid"
                                       },
                                       {
                                          "name": lang.mpeg4_cuvid,
                                          "value": "mpeg4_cuvid"
                                       },
                                   ]
                                },
                                {
                                   "name": lang["Quick Sync Video"],
                                   "optgroup": [
                                       {
                                          "name": lang.h264_qsv,
                                          "value": "h264_qsv"
                                       },
                                       {
                                          "name": lang.hevc_qsv,
                                          "value": "hevc_qsv"
                                       },
                                       {
                                          "name": lang.mpeg2_qsv,
                                          "value": "mpeg2_qsv"
                                       },
                                   ]
                                },
                                {
                                   "name": lang['Raspberry Pi'],
                                   "optgroup": [
                                       {
                                          "name": lang.h264_mmal,
                                          "value": "h264_mmal"
                                       },
                                       {
                                          "name": lang.mpeg2_mmal,
                                          "value": "mpeg2_mmal"
                                       },
                                       {
                                          "name": lang["MPEG-4 (Raspberry Pi)"],
                                          "value": "mpeg4_mmal"
                                       }
                                   ]
                                },
                               ]
                        },
                        {
                            name:'detail-substream-input=hwaccel_device',
                            field:lang['hwaccel_device'],
                            class:'h_accel_SUBSTREAM_FIELDS_input h_accel_SUBSTREAM_FIELDS_1',
                            hidden:true,
                            placeholder:'Example : /dev/dri/video0',
                            type:'text',
                        },
                        {
                            name:'detail-substream-input=cust_input',
                            field:lang['Input Flags'],
                            type:'text',
                        },
                    ]
                },
                {
                    "name": lang['Output'],
                    "color": "blue",
                    id: "monSectionSubstreamOutput",
                    "blockquote": lang.substreamOutputText,
                    "blockquoteClass": 'global_tip',
                    isSection: true,
                    isFormGroupGroup: true,
                    "info": [
                        {
                           "field": lang["Stream Type"],
                           "name": `detail-substream-output="stream_type"`,
                           "description": lang["fieldTextDetailSubstreamOutputStreamType"],
                           "default": "hls",
                           "selector": "h_st_channel_SUBSTREAM_FIELDS",
                           "fieldType": "select",
                           "attribute": `triggerChange="#monSectionChannelSUBSTREAM_FIELDS [detail-substream-output=stream_vcodec]" triggerChangeIgnore="b64,mjpeg"`,
                           "possible": [
                                {
                                   "name": lang.Poseidon,
                                   "value": "mp4",
                                },
                                {
                                   "name": lang['MJPEG'],
                                   "value": "mjpeg",
                                },
                                {
                                   "name": lang['FLV'],
                                   "value": "flv",
                                },
                                {
                                   "name": lang['HLS (includes Audio)'],
                                   "value": "hls",
                                   selected: true,
                                }
                             ]
                        },
                        {
                           "field": lang['# of Allow MJPEG Clients'],
                           "name": `detail-substream-output="stream_mjpeg_clients"`,
                           "form-group-class": "h_st_channel_SUBSTREAM_FIELDS_input h_st_channel_SUBSTREAM_FIELDS_mjpeg",
                           "placeholder": "20",
                        },
                        {
                           "field": lang['Video Codec'],
                           "name": `detail-substream-output="stream_vcodec"`,
                           "description": lang["fieldTextDetailSubstreamOutputStreamVcodec"],
                           "default": "copy",
                           "form-group-class": "h_st_channel_SUBSTREAM_FIELDS_input h_st_channel_SUBSTREAM_FIELDS_hls h_st_channel_SUBSTREAM_FIELDS_rtmp h_st_channel_SUBSTREAM_FIELDS_flv h_st_channel_SUBSTREAM_FIELDS_mp4 h_st_channel_SUBSTREAM_FIELDS_h264",
                           "fieldType": "select",
                           "selector": "h_hls_v_channel_SUBSTREAM_FIELDS",
                           "possible": [
                              {
                                 "name": lang.Auto,
                                 "value": "no",
                                 "info": lang["fieldTextDetailSubstreamOutputStreamVcodecAuto"],
                                 selected: true,
                              },
                              {
                                 "name": "libx264",
                                 "value": "libx264",
                                 "info": lang["fieldTextDetailSubstreamOutputStreamVcodecLibx264"]
                              },
                              {
                                 "name": "libx265",
                                 "value": "libx265",
                                 "info": lang["fieldTextDetailSubstreamOutputStreamVcodecLibx265"]
                              },
                              {
                                 "name": lang.copy,
                                 "value": "copy",
                                 "info": lang["fieldTextDetailSubstreamOutputStreamVcodecCopy"]
                              },
                              {
                                  "name": lang['Hardware Accelerated'],
                                  "optgroup": [
                                      {
                                         "name": "H.264 VA-API (Intel HW Accel)",
                                         "value": "h264_vaapi"
                                      },
                                      {
                                         "name": "H.265 VA-API (Intel HW Accel)",
                                         "value": "hevc_vaapi"
                                      },
                                      {
                                         "name": "H.264 NVENC (NVIDIA HW Accel)",
                                         "value": "h264_nvenc"
                                      },
                                      {
                                         "name": "H.264 NVENC Jetson (NVIDIA HW Accel NVMPI)",
                                         "value": "h264_nvmpi"
                                      },
                                      {
                                         "name": "H.265 NVENC (NVIDIA HW Accel)",
                                         "value": "hevc_nvenc"
                                      },
                                      {
                                         "name": "H.264 (Quick Sync Video)",
                                         "value": "h264_qsv"
                                      },
                                      {
                                         "name": "H.265 (Quick Sync Video)",
                                         "value": "hevc_qsv"
                                      },
                                      {
                                         "name": "MPEG2 (Quick Sync Video)",
                                         "value": "mpeg2_qsv"
                                      },
                                      {
                                         "name": "H.264 (Quick Sync Video)",
                                         "value": "h264_qsv"
                                      },
                                      {
                                         "name": "H.265 (Quick Sync Video)",
                                         "value": "hevc_qsv"
                                      },
                                      {
                                         "name": "MPEG2 (Quick Sync Video)",
                                         "value": "mpeg2_qsv"
                                      },
                                      {
                                         "name": "H.264 openMAX (Raspberry Pi)",
                                         "value": "h264_omx"
                                      }
                                  ]
                              },
                           ]
                        },
                        {
                           "field": lang["Audio Codec"],
                           "name": `detail-substream-output="stream_acodec"`,
                           "description": lang["fieldTextDetailSubstreamOutputStreamAcodec"],
                           "default": "",
                           "example": "",
                           "fieldType": "select",
                           "form-group-class": "h_st_channel_SUBSTREAM_FIELDS_input h_st_channel_SUBSTREAM_FIELDS_hls h_st_channel_SUBSTREAM_FIELDS_rtmp h_st_channel_SUBSTREAM_FIELDS_flv h_st_channel_SUBSTREAM_FIELDS_mp4 h_st_channel_SUBSTREAM_FIELDS_h264",
                           "possible": [
                              {
                                 "name": lang.Auto,
                                 "info": lang["fieldTextDetailSubstreamOutputStreamAcodecAuto"],
                                 "value": "",
                                 selected: true,
                              },
                              {
                                 "name": lang["No Audio"],
                                 "info": lang["fieldTextDetailSubstreamOutputStreamAcodecNoAudio"],
                                 "value": "no"
                              },
                              {
                                 "name": "libvorbis",
                                 "info": lang["fieldTextDetailSubstreamOutputStreamAcodecLibvorbis"],
                                 "value": "libvorbis"
                              },
                              {
                                 "name": "libopus",
                                 "info": lang["fieldTextDetailSubstreamOutputStreamAcodecLibopus"],
                                 "value": "libopus"
                              },
                              {
                                 "name": "libmp3lame",
                                 "info": lang["fieldTextDetailSubstreamOutputStreamAcodecLibmp3lame"],
                                 "value": "libmp3lame"
                              },
                              {
                                 "name": "aac",
                                 "info": lang["fieldTextDetailSubstreamOutputStreamAcodecAac"],
                                 "value": "aac"
                              },
                              {
                                 "name": "ac3",
                                 "info": lang["fieldTextDetailSubstreamOutputStreamAcodecAc3"],
                                 "value": "ac3"
                              },
                              {
                                 "name": "copy",
                                 "info": lang["fieldTextDetailSubstreamOutputStreamAcodecCopy"],
                                 "value": "copy"
                              }
                           ]
                        },
                        {
                           "name": "detail-substream-output=hls_time",
                           "field": lang["HLS Segment Length"],
                           "description": lang["fieldTextDetailSubstreamOutputHlsTime"],
                           "default": "2",
                           "form-group-class": "h_st_channel_SUBSTREAM_FIELDS_input h_st_channel_SUBSTREAM_FIELDS_hls",
                        },
                        {
                           "name": "detail-substream-output=hls_list_size",
                           "field": lang["HLS List Size"],
                           "description": lang["fieldTextDetailSubstreamOutputHlsListSize"],
                           "default": "2",
                           "form-group-class": "h_st_channel_SUBSTREAM_FIELDS_input h_st_channel_SUBSTREAM_FIELDS_hls",
                        },
                        {
                           "name": "detail-substream-output=preset_stream",
                           "field": lang["HLS Preset"],
                           "description": lang["fieldTextDetailSubstreamOutputPresetStream"],
                           "example": "ultrafast",
                           "form-group-class": "h_st_channel_SUBSTREAM_FIELDS_input h_st_channel_SUBSTREAM_FIELDS_hls",
                        },
                        {
                           "name": "detail-substream-output=stream_quality",
                           "field": lang.Quality,
                           "description": lang["fieldTextDetailSubstreamOutputStreamQuality"],
                           "default": "15",
                           "example": "1",
                           // "form-group-class-pre-layer": "h_hls_v_channel_SUBSTREAM_FIELDS_input h_hls_v_channel_SUBSTREAM_FIELDS_libx264 h_hls_v_channel_SUBSTREAM_FIELDS_libx265 h_hls_v_channel_SUBSTREAM_FIELDS_h264_nvenc h_hls_v_channel_SUBSTREAM_FIELDS_hevc_nvenc h_hls_v_channel_SUBSTREAM_FIELDS_no",
                           "form-group-class": "h_st_channel_SUBSTREAM_FIELDS_input h_st_channel_SUBSTREAM_FIELDS_mjpeg h_st_channel_SUBSTREAM_FIELDS_hls h_st_channel_SUBSTREAM_FIELDS_rtmp h_st_channel_SUBSTREAM_FIELDS_jsmpeg h_st_channel_SUBSTREAM_FIELDS_flv h_st_channel_SUBSTREAM_FIELDS_mp4 h_st_channel_SUBSTREAM_FIELDS_h264",
                           "possible": "1-23"
                        },
                        {
                           "name": "detail-substream-output=stream_v_br",
                           "field": lang["Video Bit Rate"],
                           "placeholder": "",
                           "form-group-class-pre-layer": "h_hls_v_channel_SUBSTREAM_FIELDS_input h_hls_v_channel_SUBSTREAM_FIELDS_libx264 h_hls_v_channel_SUBSTREAM_FIELDS_libx265 h_hls_v_channel_SUBSTREAM_FIELDS_h264_nvenc h_hls_v_channel_SUBSTREAM_FIELDS_hevc_nvenc h_hls_v_channel_SUBSTREAM_FIELDS_no",
                           "form-group-class": "h_st_channel_SUBSTREAM_FIELDS_input h_st_channel_SUBSTREAM_FIELDS_mjpeg h_st_channel_SUBSTREAM_FIELDS_hls h_st_channel_SUBSTREAM_FIELDS_rtmp h_st_channel_SUBSTREAM_FIELDS_jsmpeg h_st_channel_SUBSTREAM_FIELDS_flv h_st_channel_SUBSTREAM_FIELDS_mp4 h_st_channel_SUBSTREAM_FIELDS_h264",
                        },
                        {
                           "name": "detail-substream-output=stream_a_br",
                           "field": lang["Audio Bit Rate"],
                           "placeholder": "128k",
                           "form-group-class-pre-layer": "h_hls_v_channel_SUBSTREAM_FIELDS_input h_hls_v_channel_SUBSTREAM_FIELDS_libx264 h_hls_v_channel_SUBSTREAM_FIELDS_libx265 h_hls_v_channel_SUBSTREAM_FIELDS_h264_nvenc h_hls_v_channel_SUBSTREAM_FIELDS_hevc_nvenc h_hls_v_channel_SUBSTREAM_FIELDS_no",
                           "form-group-class": "h_st_channel_SUBSTREAM_FIELDS_input h_st_channel_SUBSTREAM_FIELDS_mjpeg h_st_channel_SUBSTREAM_FIELDS_hls h_st_channel_SUBSTREAM_FIELDS_rtmp h_st_channel_SUBSTREAM_FIELDS_jsmpeg h_st_channel_SUBSTREAM_FIELDS_flv h_st_channel_SUBSTREAM_FIELDS_mp4 h_st_channel_SUBSTREAM_FIELDS_h264",
                        },
                        {
                           "name": "detail-substream-output=stream_fps",
                           "field": lang['Frame Rate'],
                           "description": lang["fieldTextDetailSubstreamOutputStreamFps"],
                           // "form-group-class-pre-layer": "h_hls_v_channel_SUBSTREAM_FIELDS_input h_hls_v_channel_SUBSTREAM_FIELDS_libx264 h_hls_v_channel_SUBSTREAM_FIELDS_libx265 h_hls_v_channel_SUBSTREAM_FIELDS_h264_nvenc h_hls_v_channel_SUBSTREAM_FIELDS_hevc_nvenc h_hls_v_channel_SUBSTREAM_FIELDS_no",
                           "form-group-class": "h_st_channel_SUBSTREAM_FIELDS_input h_st_channel_SUBSTREAM_FIELDS_mjpeg h_st_channel_SUBSTREAM_FIELDS_hls h_st_channel_SUBSTREAM_FIELDS_rtmp h_st_channel_SUBSTREAM_FIELDS_jsmpeg h_st_channel_SUBSTREAM_FIELDS_flv h_st_channel_SUBSTREAM_FIELDS_mp4 h_st_channel_SUBSTREAM_FIELDS_h264",
                        },
                        {
                           "name": "detail-substream-output=stream_scale_x",
                           "field": lang.Width,
                           "description": lang["fieldTextDetailSubstreamOutputStreamScaleX"],
                           "fieldType": "number",
                           "numberMin": "1",
                           "example": "640",
                           // "form-group-class-pre-layer": "h_hls_v_channel_SUBSTREAM_FIELDS_input h_hls_v_channel_SUBSTREAM_FIELDS_libx264 h_hls_v_channel_SUBSTREAM_FIELDS_libx265 h_hls_v_channel_SUBSTREAM_FIELDS_h264_nvenc h_hls_v_channel_SUBSTREAM_FIELDS_hevc_nvenc h_hls_v_channel_SUBSTREAM_FIELDS_no",
                           "form-group-class": "h_st_channel_SUBSTREAM_FIELDS_input h_st_channel_SUBSTREAM_FIELDS_mjpeg h_st_channel_SUBSTREAM_FIELDS_hls h_st_channel_SUBSTREAM_FIELDS_rtmp h_st_channel_SUBSTREAM_FIELDS_jsmpeg h_st_channel_SUBSTREAM_FIELDS_flv h_st_channel_SUBSTREAM_FIELDS_mp4 h_st_channel_SUBSTREAM_FIELDS_h264",
                        },
                        {
                           "name": "detail-substream-output=stream_scale_y",
                           "field": lang.Height,
                           "description": lang["fieldTextDetailSubstreamOutputStreamScaleY"],
                           "fieldType": "number",
                           "numberMin": "1",
                           "example": "480",
                           // "form-group-class-pre-layer": "h_hls_v_channel_SUBSTREAM_FIELDS_input h_hls_v_channel_SUBSTREAM_FIELDS_libx264 h_hls_v_channel_SUBSTREAM_FIELDS_libx265 h_hls_v_channel_SUBSTREAM_FIELDS_h264_nvenc h_hls_v_channel_SUBSTREAM_FIELDS_hevc_nvenc h_hls_v_channel_SUBSTREAM_FIELDS_no",
                           "form-group-class": "h_st_channel_SUBSTREAM_FIELDS_input h_st_channel_SUBSTREAM_FIELDS_mjpeg h_st_channel_SUBSTREAM_FIELDS_hls h_st_channel_SUBSTREAM_FIELDS_rtmp h_st_channel_SUBSTREAM_FIELDS_jsmpeg h_st_channel_SUBSTREAM_FIELDS_flv h_st_channel_SUBSTREAM_FIELDS_mp4 h_st_channel_SUBSTREAM_FIELDS_h264",
                        },
                        {
                           "name": "detail-substream-output=stream_rotate",
                           "field": lang["Rotate"],
                           "description": lang["fieldTextDetailSubstreamOutputStreamRotate"],
                           "fieldType": "select",
                           // "form-group-class-pre-layer": "h_hls_v_channel_SUBSTREAM_FIELDS_input h_hls_v_channel_SUBSTREAM_FIELDS_libx264 h_hls_v_channel_SUBSTREAM_FIELDS_libx265 h_hls_v_channel_SUBSTREAM_FIELDS_h264_nvenc h_hls_v_channel_SUBSTREAM_FIELDS_hevc_nvenc h_hls_v_channel_SUBSTREAM_FIELDS_no",
                           "form-group-class": "h_st_channel_SUBSTREAM_FIELDS_input h_st_channel_SUBSTREAM_FIELDS_mjpeg h_st_channel_SUBSTREAM_FIELDS_hls h_st_channel_SUBSTREAM_FIELDS_rtmp h_st_channel_SUBSTREAM_FIELDS_jsmpeg h_st_channel_SUBSTREAM_FIELDS_flv h_st_channel_SUBSTREAM_FIELDS_mp4 h_st_channel_SUBSTREAM_FIELDS_h264",
                           "possible": [
                                {
                                   "name": lang["No Rotation"],
                                   "value": "no"
                                },
                                {
                                   "name": lang["180 Degrees"],
                                   "value": "2,transpose=2"
                                },
                                {
                                   "name": lang["90 Counter Clockwise and Vertical Flip (default)"],
                                   "value": "0"
                                },
                                {
                                   "name": lang["90 Clockwise"],
                                   "value": "1"
                                },
                                {
                                   "name": lang["90 Counter Clockwise"],
                                   "value": "2"
                                },
                                {
                                   "name": lang["90 Clockwise and Vertical Flip"],
                                   "value": "3"
                                }
                             ]
                        },
                        {
                            isAdvanced: true,
                           "name": "detail-substream-output=svf",
                           "field": lang["Video Filter"],
                           "description": lang["fieldTextDetailSubstreamOutputSvf"],
                           // "form-group-class-pre-layer": "h_hls_v_channel_SUBSTREAM_FIELDS_input h_hls_v_channel_SUBSTREAM_FIELDS_libx264 h_hls_v_channel_SUBSTREAM_FIELDS_libx265 h_hls_v_channel_SUBSTREAM_FIELDS_h264_nvenc h_hls_v_channel_SUBSTREAM_FIELDS_hevc_nvenc h_hls_v_channel_SUBSTREAM_FIELDS_no",
                           "form-group-class": "h_st_channel_SUBSTREAM_FIELDS_input h_st_channel_SUBSTREAM_FIELDS_mjpeg h_st_channel_SUBSTREAM_FIELDS_hls h_st_channel_SUBSTREAM_FIELDS_rtmp h_st_channel_SUBSTREAM_FIELDS_jsmpeg h_st_channel_SUBSTREAM_FIELDS_flv h_st_channel_SUBSTREAM_FIELDS_mp4 h_st_channel_SUBSTREAM_FIELDS_h264",
                       },
                       {
                           "name": "detail-substream-output=cust_stream",
                           "field": lang["Stream Flags"],
                       },
                    ]
                },
            ]
        },
          "JPEG API": {
             "name": lang['JPEG API'],
             "headerTitle": `${lang['JPEG API']} <small>${lang.Snapshot} (cgi-bin)</small>`,
             "id": "monSectionJPEGAPI",
             "color": "forestgreen",
             "isSection": true,
             "input-mapping": "snap",
             "info": [
                 {
                    "name": "detail=snap",
                    "field": lang.Enabled,
                    "description": lang["fieldTextSnap"],
                    "default": "0",
                    "example": "",
                    "fieldType": "select",
                    "selector": "h_sn",
                    "possible": yesNoPossibility
                },
                {
                    hidden: true,
                   "name": "detail=snap_fps",
                   "field": lang['Frame Rate'],
                   "description": "",
                   "default": "1",
                   "example": "",
                   "form-group-class": "h_sn_input h_sn_1",
                   "possible": ""
                },
                {
                    hidden: true,
                   "name": "detail=snap_scale_x",
                   "field": lang['Image Width'],
                   "description": "",
                   "default": "",
                   "example": "",
                   "form-group-class": "h_sn_input h_sn_1",
                   "possible": ""
                },
                {
                    hidden: true,
                   "name": "detail=snap_scale_y",
                   "field": lang['Image Height'],
                   "description": "",
                   "default": "",
                   "example": "",
                   "form-group-class": "h_sn_input h_sn_1",
                   "possible": ""
                },
                {
                    isAdvanced: true,
                    hidden: true,
                   "name": "detail=snap_vf",
                   "field": lang['Video Filter'],
                   "description": "",
                   "default": "",
                   "example": "",
                   "form-group-class": "h_sn_input h_sn_1",
                   "possible": ""
                },
             ]
          },
          "Recording": {
             "id": "monSectionRecording",
             "name": lang.Recording,
             "color": "red",
             "isSection": true,
             "input-mapping": "record",
             "blockquote": lang.RecordingText,
             "blockquoteClass": 'global_tip',
             "section-class": 'h_m_input h_m_record h_m_idle',
             "info": [
                 // {
                 //    "name": "height",
                 //    "field": lang.Height,
                 //    "description": lang["fieldTextRecordScaleY"],
                 //    "default": "640",
                 //    "example": "1280",
                 //    "possible": ""
                 // },
                 // {
                 //    "name": "width",
                 //    "field": lang.Width,
                 //    "description": lang["fieldTextRecordScaleX"],
                 //    "default": "480",
                 //    "example": "720",
                 //    "possible": ""
                 // },
                {
                   "name": "ext",
                   "field": lang["Record File Type"],
                   "description": lang["fieldTextExt"],
                   "default": "MP4",
                   "example": "",
                   "selector": "h_f",
                   "fieldType": "select",
                   "possible": [
                      {
                         "name": "MP4",
                         "value": "mp4",
                         "info": lang["fieldTextExtMP4"]
                      },
                      {
                         "name": "WebM",
                         "value": "webm",
                         "info": lang["fieldTextExtWebM"]
                      }
                   ]
                },
                {
                   "name": "detail=vcodec",
                   "field": lang["Video Codec"],
                   "description": lang["fieldTextVcodec"],
                   "default": "copy",
                   "example": "",
                   "selector": "h_vc",
                   "fieldType": "select",
                   "possible": [
                        {
                           "name": lang.Default,
                           "value": "default"
                        },
                        {
                           "name": lang.Auto,
                           "value": "none"
                        },
                        {
                           "name": "WebM",
                           "optgroup": [
                              {
                                 "name": "libvpx (Default)",
                                 "value": "libvpx"
                              },
                              {
                                 "name": "libvpx-vp9",
                                 "value": "libvpx-vp9"
                              }
                           ]
                        },
                        {
                           "name": "MP4",
                           "optgroup": [
                              {
                                 "name": "libx265",
                                 "value": "libx265"
                              },
                              {
                                 "name": "libx264 (Default)",
                                 "value": "libx264"
                              },
                              {
                                 "name": "copy",
                                 "value": "copy"
                              }
                           ]
                        },
                        {
                           "name": "MP4 Hardware Accelerated",
                           "optgroup": [
                              {
                                 "name": "H.264 VA-API (Intel HW Accel)",
                                 "value": "h264_vaapi"
                              },
                              {
                                 "name": "H.265 VA-API (Intel HW Accel)",
                                 "value": "hevc_vaapi"
                              },
                              {
                                 "name": "H.264 NVENC (NVIDIA HW Accel)",
                                 "value": "h264_nvenc"
                              },
                              {
                                 "name": "H.264 NVENC Jetson (NVIDIA HW Accel NVMPI)",
                                 "value": "h264_nvmpi"
                              },
                              {
                                 "name": "H.265 NVENC (NVIDIA HW Accel)",
                                 "value": "hevc_nvenc"
                              },
                              {
                                 "name": "H.264 (Quick Sync Video)",
                                 "value": "h264_qsv"
                              },
                              {
                                 "name": "H.265 (Quick Sync Video)",
                                 "value": "hevc_qsv"
                              },
                              {
                                 "name": "MPEG2 (Quick Sync Video)",
                                 "value": "mpeg2_qsv"
                              },
                              {
                                 "name": "H.264 openMAX (Raspberry Pi)",
                                 "value": "h264_omx"
                              }
                           ]
                        },
                        {
                           "name": "WebM Hardware Accelerated",
                           "optgroup": [
                              {
                                 "name": "VP8 NVENC (NVIDIA HW Accel)",
                                 "value": "vp8_cuvid"
                              },
                              {
                                 "name": "VP9 NVENC (NVIDIA HW Accel)",
                                 "value": "vp9_cuvid"
                              },
                              {
                                 "name": "VP8 (Quick Sync Video)",
                                 "value": "vp8_qsv"
                              }
                           ]
                        }
                     ]
                },
                {
                   "name": "detail=crf",
                   "field": lang.Quality,
                   "description": lang["fieldTextCrf"],
                   "default": "15",
                   "example": "1",
                   "form-group-class": "h_vc_input h_vc_libvpx h_vc_libvpx-vp9 h_vc_libx264 h_vc_libx265 h_vc_hevc_nvenc h_vc_h264_nvenc h_vc_h264_nvmpi h_vc_h264_vaapi h_vc_hevc_vaapi h_vc_h264_qsv h_vc_hevc_qsv h_vc_mpeg2_qsv h_vc_default h_vc_none",
                   "possible": "1-23"
                },
                {
                    isAdvanced: true,
                   "name": "detail=preset_record",
                   "field": lang.Preset,
                   "description": lang["fieldTextPresetRecord"],
                   "default": "",
                   "example": "ultrafast",
                   "form-group-class": "h_vc_input h_vc_libvpx h_vc_libvpx-vp9 h_vc_libx264 h_vc_libx265 h_vc_hevc_nvenc h_vc_h264_nvenc h_vc_h264_nvmpi h_vc_h264_vaapi h_vc_hevc_vaapi h_vc_h264_qsv h_vc_hevc_qsv h_vc_mpeg2_qsv h_vc_default h_vc_none",
                   "possible": ""
                },
                {
                   "name": "detail=acodec",
                   "field": lang['Audio Codec'],
                   "description": lang["fieldTextAcodec"],
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "possible": [
                      {
                         "name": lang.Default,
                         "value": "default"
                      },
                      {
                         "name": lang.Auto,
                         "value": "none"
                      },
                      {
                         "name": lang["No Audio"],
                         "value": "no"
                      },
                      {
                         "name": "WebM",
                         "optgroup": [
                            {
                               "name": `libvorbis (${lang.Default})`,
                               "value": "libvorbis"
                            },
                            {
                               "name": "libopus",
                               "value": "libopus"
                            }
                         ]
                      },
                      {
                         "name": "MP4",
                         "optgroup": [
                            {
                               "name": "libmp3lame",
                               "value": "libmp3lame"
                            },
                            {
                               "name": `aac (${lang.Default})`,
                               "value": "aac"
                            },
                            {
                               "name": "ac3",
                               "value": "ac3"
                            },
                            {
                               "name": "copy",
                               "value": "copy"
                            }
                         ]
                      }
                   ]
                },
                {
                   "name": "fps",
                   "field": lang["Video Record Rate"],
                   "description": lang["fieldTextFps"],
                   "default": "",
                   "example": "2",
                   "form-group-class": "h_vc_input h_vc_libvpx h_vc_libvpx-vp9 h_vc_libx264 h_vc_libx265 h_vc_hevc_nvenc h_vc_h264_nvenc h_vc_h264_nvmpi h_vc_h264_vaapi h_vc_hevc_vaapi h_vc_h264_qsv h_vc_hevc_qsv h_vc_mpeg2_qsv h_vc_default h_vc_none",
                   "possible": ""
                },
                {
                   "name": "detail=record_scale_y",
                   "field": lang["Record Height"],
                   "description": "Height of the stream image.",
                   "default": "",
                   "example": "720",
                   "form-group-class": "h_vc_input h_vc_libvpx h_vc_libvpx-vp9 h_vc_libx264 h_vc_libx265 h_vc_hevc_nvenc h_vc_h264_nvenc h_vc_h264_nvmpi h_vc_h264_vaapi h_vc_hevc_vaapi h_vc_h264_qsv h_vc_hevc_qsv h_vc_mpeg2_qsv h_vc_default h_vc_none",
                   "possible": ""
                },
                {
                   "name": "detail=record_scale_x",
                   "field": lang["Record Width"],
                   "description": "Width of the stream image.",
                   "default": "",
                   "example": "1280",
                   "form-group-class": "h_vc_input h_vc_libvpx h_vc_libvpx-vp9 h_vc_libx264 h_vc_libx265 h_vc_hevc_nvenc h_vc_h264_nvenc h_vc_h264_nvmpi h_vc_h264_vaapi h_vc_hevc_vaapi h_vc_h264_qsv h_vc_hevc_qsv h_vc_mpeg2_qsv h_vc_default h_vc_none",
                   "possible": ""
                },
                {
                   "name": "detail=cutoff",
                   "field": lang['Recording Segment Interval'],
                   "description": lang["fieldTextCutoff"],
                   "default": "15",
                   "example": "60",
                   "attribute": `triggerChange="#add_monitor [detail=vcodec]"`,
                   "possible": ""
                },
                {
                   "name": "detail=rotate",
                   "field": lang["Rotate"],
                   "description": lang["fieldTextRotate"],
                   "default": "copy",
                   "example": "",
                   "selector": "h_vc",
                   "fieldType": "select",
                   "form-group-class": "h_vc_input h_vc_libvpx h_vc_libvpx-vp9 h_vc_libx264 h_vc_libx265 h_vc_hevc_nvenc h_vc_h264_nvenc h_vc_h264_nvmpi h_vc_h264_vaapi h_vc_hevc_vaapi h_vc_h264_qsv h_vc_hevc_qsv h_vc_mpeg2_qsv h_vc_default h_vc_none",
                   "possible": [
                        {
                           "name": lang["No Rotation"],
                           "value": "no"
                        },
                        {
                           "name": lang["180 Degrees"],
                           "value": "2,transpose=2"
                        },
                        {
                           "name": lang["90 Counter Clockwise and Vertical Flip (default)"],
                           "value": "0"
                        },
                        {
                           "name": lang["90 Clockwise"],
                           "value": "1"
                        },
                        {
                            "name": lang["90 Counter Clockwise"],
                            "value": "2"
                        },
                        {
                           "name": lang["90 Clockwise and Vertical Flip"],
                           "value": "3"
                        }
                     ]
                },
                {
                    isAdvanced: true,
                   "name": "detail=vf",
                   "field": lang['Record Video Filter'],
                   "description": lang["fieldTextVf"],
                   "default": "",
                   "example": "",
                   "form-group-class": "h_vc_input h_vc_libvpx h_vc_libvpx-vp9 h_vc_libx264 h_vc_libx265 h_vc_hevc_nvenc h_vc_h264_nvenc h_vc_h264_nvmpi h_vc_h264_vaapi h_vc_hevc_vaapi h_vc_h264_qsv h_vc_hevc_qsv h_vc_mpeg2_qsv h_vc_default h_vc_none",
                   "possible": ""
                }
             ]
          },
          "Recording Timestamp": {
             "id": "monSectionRecordingTimestamp",
             "name": lang['Recording Timestamp'],
             "color": "red",
             isAdvanced: true,
             "section-pre-class": "h_vc_input h_vc_libvpx h_vc_libvpx-vp9 h_vc_libx264 h_vc_libx265 h_vc_hevc_nvenc h_vc_h264_nvenc h_vc_h264_nvmpi h_vc_h264_vaapi h_vc_hevc_vaapi h_vc_h264_qsv h_vc_hevc_qsv h_vc_mpeg2_qsv h_vc_default h_vc_none",
             "section-class": "h_m_input h_m_record h_m_idle",
             "isSection": true,
             "info": [
                 {
                    "name": "detail=timestamp",
                    "selector":"h_rtm",
                    "field": lang.Enabled,
                    "description": lang["fieldTextTimestamp"],
                    "default": "0",
                    "example": "",
                    "fieldType": "select",
                    "possible": yesNoPossibility
                },
                {
                    hidden: true,
                   "name": "detail=timestamp_font",
                   "field": "Font Path",
                   "description": lang["fieldTextTimestampFont"],
                   "default": "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
                   "example": "",
                   "form-group-class": "h_rtm_input h_rtm_1",
                   "possible": ""
                },
                {
                    hidden: true,
                   "name": "detail=timestamp_font_size",
                   "field": "Font Size",
                   "description": lang["fieldTextTimestampFontSize"],
                   "default": "10",
                   "example": "",
                   "form-group-class": "h_rtm_input h_rtm_1",
                   "possible": ""
                },
                {
                    hidden: true,
                   "name": "detail=timestamp_color",
                   "field": "Text Color",
                   "description": lang["fieldTextTimestampColor"],
                   "default": "white",
                   "example": "",
                   "form-group-class": "h_rtm_input h_rtm_1",
                   "possible": ""
                },
                {
                    hidden: true,
                   "name": "detail=timestamp_box_color",
                   "field": "Text Box Color",
                   "description": lang["fieldTextTimestampBoxColor"],
                   "default": "0x00000000@1",
                   "example": "",
                   "form-group-class": "h_rtm_input h_rtm_1",
                   "possible": ""
                },
                {
                    hidden: true,
                   "name": "detail=timestamp_x",
                   "field": "Position X",
                   "description": lang["fieldTextTimestampX"],
                   "default": "(w-tw)/2",
                   "example": "",
                   "form-group-class": "h_rtm_input h_rtm_1",
                   "possible": ""
                },
                {
                    hidden: true,
                   "name": "detail=timestamp_y",
                   "field": "Position Y",
                   "description": lang["fieldTextTimestampY"],
                   "default": "0",
                   "example": "",
                   "form-group-class": "h_rtm_input h_rtm_1",
                   "possible": ""
                }
             ]
          },
          "Recording Watermark": {
             "id": "monSectionRecordingWatermark",
             "name": lang['Recording Watermark'],
             "color": "red",
             isAdvanced: true,
             "section-pre-class": "h_vc_input h_vc_libvpx h_vc_libvpx-vp9 h_vc_libx264 h_vc_libx265 h_vc_hevc_nvenc h_vc_h264_nvenc h_vc_h264_nvmpi h_vc_h264_vaapi h_vc_hevc_vaapi h_vc_h264_qsv h_vc_hevc_qsv h_vc_mpeg2_qsv h_vc_default h_vc_none",
             "section-class": "h_m_input h_m_record h_m_idle",
             "isSection": true,
             "info": [
                 {
                    "name": "detail=watermark",
                    "field": lang.Enabled,
                    "description": lang["fieldTextWatermark"],
                    "default": "0",
                    "example": "",
                    "fieldType": "select",
                    "selector": "h_wat",
                    "possible": yesNoPossibility
                },
                {
                    hidden: true,
                   "name": "detail=watermark_location",
                   "field": lang['Image Location'],
                   "description": lang["fieldTextWatermarkLocation"],
                   "default": "0",
                   "example": "/usr/share/watermark.logo",
                   "form-group-class": "h_wat_input h_wat_1",
                   "possible": ""
                },
                {
                    hidden: true,
                    "name": "detail=watermark_position",
                    "field": lang['Image Position'],
                    "description": lang["fieldTextWatermarkPosition"],
                    "default": "0",
                    "example": "",
                    "fieldType": "select",
                    "form-group-class": "h_wat_input h_wat_1",
                    "possible": [
                        {
                           "name": lang["Top Right"],
                           "value": "tr"
                        },
                        {
                           "name": lang["Top Left"],
                           "value": "tl"
                        },
                        {
                           "name": lang["Bottom Right"],
                           "value": "br"
                        },
                        {
                           "name": lang["Bottom Left"],
                           "value": "bl"
                        }
                     ]
                },
             ]
          },
          "Timelapse": {
             "name": lang['Timelapse'],
             "id": "monSectionTimelapse",
             "color": "red",
             "isSection": true,
             "input-mapping": "record_timelapse",
             "info": [
                 {
                    "name": "detail=record_timelapse",
                    "field": lang.Enabled,
                    "description": lang["fieldTextRecordTimelapse"],
                    "default": "0",
                    "example": "",
                    "fieldType": "select",
                    "selector": "h_rec_ti",
                    "possible": yesNoPossibility
                },
                {
                    hidden: true,
                   "name": "detail=record_timelapse_mp4",
                   "field": lang.Enabled,
                   "description": lang["fieldTextRecordTimelapseMp4"],
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "possible": yesNoPossibility
                },
                {
                    hidden: true,
                   "name": "detail=record_timelapse_fps",
                   "field": lang['Creation Interval'],
                   "default": "900",
                   "form-group-class": "h_rec_ti_input h_rec_ti_1",
                   "fieldType": "select",
                   "possible": [
                     {
                         "name": `.1 ${lang.minutes}`,
                         "value": "6"
                     },
                     {
                         "name": `.25 ${lang.minutes}`,
                         "value": "15"
                     },
                     {
                         "name": `.5 ${lang.minutes}`,
                         "value": "30"
                     },
                     {
                         "name": `1 ${lang.minute}`,
                         "value": "60"
                     },
                     {
                         "name": `5 ${lang.minutes}`,
                         "value": "300"
                     },
                     {
                         "name": `10 ${lang.minutes}`,
                         "value": "600"
                     },
                     {
                         "name": `15 ${lang.minutes}`,
                         "value": "900"
                     },
                     {
                         "name": `30 ${lang.minutes}`,
                         "value": "1800"
                     },
                     {
                         "name": `45 ${lang.minutes}`,
                         "value": "2700"
                     },
                     {
                         "name": `60 ${lang.minutes}`,
                         "value": "3600"
                      }
                   ]
                },
                {
                    hidden: true,
                   "name": "detail=record_timelapse_scale_x",
                   "field": lang['Image Width'],
                   "form-group-class": "h_rec_ti_input h_rec_ti_1",
                },
                {
                    hidden: true,
                   "name": "detail=record_timelapse_scale_y",
                   "field": lang['Image Height'],
                   "form-group-class": "h_rec_ti_input h_rec_ti_1",
                },
                {
                    isAdvanced: true,
                    hidden: true,
                   "name": "detail=record_timelapse_vf",
                   "field": lang['Video Filter'],
                   "form-group-class": "h_rec_ti_input h_rec_ti_1",
                },
             ]
          },
          "Timelapse Watermark": {
             "id": "monSectionRecordingWatermark",
             "name": lang['Timelapse Watermark'],

             "color": "red",
             isAdvanced: true,
             "section-class": "h_rec_ti_input h_rec_ti_1",
             "isSection": true,
             "info": [
                 {
                    "name": "detail=record_timelapse_watermark",
                    "field": lang.Enabled,
                    "description": lang["fieldTextRecordTimelapseWatermark"],
                    "default": "0",
                    "example": "",
                    "fieldType": "select",
                    "selector": "h_wat_timelapse",
                    "possible": yesNoPossibility
                },
                {
                    hidden: true,
                   "name": "detail=record_timelapse_watermark_location",
                   "field": lang['Image Location'],
                   "description": lang["fieldTextRecordTimelapseWatermarkLocation"],
                   "default": "0",
                   "example": "/usr/share/watermark.logo",
                   "form-group-class": "h_wat_timelapse_input h_wat_timelapse_1",
                   "possible": ""
                },
                {
                    hidden: true,
                    "name": "detail=record_timelapse_watermark_position",
                    "field": lang['Image Position'],
                    "description": lang["fieldTextRecordTimelapseWatermarkPosition"],
                    "default": "0",
                    "example": "",
                    "fieldType": "select",
                    "form-group-class": "h_wat_timelapse_input h_wat_timelapse_1",
                    "possible": [
                        {
                           "name": lang["Top Right"],
                           "value": "tr"
                        },
                        {
                           "name": lang["Top Left"],
                           "value": "tl"
                        },
                        {
                           "name": lang["Bottom Right"],
                           "value": "br"
                        },
                        {
                           "name": lang["Bottom Left"],
                           "value": "bl"
                        }
                     ]
                },
             ]
          },
          "Detector": {
             "name": lang['Detector Settings'],
             "headerTitle": `${lang['Detector Settings']} <small>${lang['Primary Engine']} : <b class="h_det_pam_input h_det_pam_1">Pixel Array</b><span class="h_det_pam_input h_det_pam_0"><b class="shinobi-detector_name"></b> <b class="shinobi-detector-invert">${lang['Not Connected']}</b><b class="shinobi-detector" style="display:none">${lang['Connected']}</b></span></small></h4>`,
             "color": "orange",
             "isSection": true,
             "input-mapping":"detector",
             "id": "monSectionDetector",
             "selector": "h_det",
             "attribute": `triggerChange="#add_monitor [detail=detector_record_method]"`,
             "blockquote": `${lang.DetectorText}\n<p class="shinobi-detector-msg"></p>`,
             "info": [
                 {
                    "fieldType": "btn",
                    "class": `btn-primary open-region-editor`,
                    "btnContent": `<i class="fa fa-grav"></i> &nbsp; ${lang['Region Editor']}`,
                    "description": "",
                    "default": "",
                    "example": "",
                    "form-group-class-pre-pre-layer": "h_det_input h_det_1",
                    "form-group-class-pre-layer": "form-group",
                    "possible": ""
                 },
                {
                   "name": "detail=detector",
                   "field": lang.Enabled,
                   "description": lang["fieldTextDetector"],
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "selector": "h_det",
                   "possible": yesNoPossibility
                },
                {
                    hidden: true,
                   "name": "detail=detector_save",
                   "field": lang["Save Events"],
                   "description": lang["fieldTextDetectorSave"],
                   "default": "1",
                   "example": "",
                   "form-group-class": "h_det_input h_det_1",
                   "fieldType": "select",
                   "possible": yesNoPossibility
                },
                {
                   "name": "detail=use_detector_filters",
                   "field": lang['Event Filters'],
                   "description": lang.fieldTextEventFilters,
                   "default": "0",
                   "example": "",
                   "selector": "h_det_fil",
                   "fieldType": "select",
                   "form-group-class-pre-layer": "h_det_input h_det_1",
                   "possible": yesNoPossibility
                },
                {
                   "name": "detail=use_detector_filters_object",
                   "field": lang['Filter for Objects only'],
                   "description": "",
                   "default": "0",
                   "fieldType": "select",
                   "form-group-class": "h_det_fil_input h_det_fil_1",
                   "form-group-class-pre-layer": "h_det_input h_det_1",
                   "possible": yesNoPossibility
                },
                {
                    isAdvanced: true,
                    hidden: true,
                   "name": "detail=detector_record_method",
                   "field": lang['How to Record'],
                   "description": lang["fieldTextDetectorRecordMethod"],
                   "selector": "h_rec_mtd",
                   "default": "sip",
                   "example": "",
                   "form-group-class": "h_det_input h_det_1",
                   "fieldType": "select",
                   "possible": [
                        {
                           "name": lang['Event-Based Recording (For Watch-Only Mode)'],
                           "value": "sip"
                        },
                        {
                           "name": lang['Delete Motionless Videos (For Record Mode)'],
                           "value": "del"
                        }
                     ]
                },
                {
                    hidden: true,
                   "name": "detail=detector_trigger",
                   "field": lang['Trigger Record'],
                   "description": "This will order the camera to record if it is set to \"Watch-Only\" when an Event is detected.",
                   "default": "0",
                   "example": "",
                   "form-group-class": "h_det_input h_det_1",
                   "form-group-class-pre-layer": "h_rec_mtd_input h_rec_mtd_hot h_rec_mtd_sip",
                   "fieldType": "select",
                   "possible": yesNoPossibility
                },
                {
                   "name": "detail=detector_buffer_seconds_before",
                   "field": lang['Buffer Time from Event'],
                   "description": lang["fieldTextBufferTimeFromEvent"],
                   "default": "5",
                   "form-group-class": "h_det_input h_det_1",
                   "form-group-class-pre-layer": "h_rec_mtd_input h_rec_mtd_sip",
                },
                {
                    hidden: true,
                   "name": "detail=detector_timeout",
                   "field": lang["Recording Timeout"],
                   "description": "The length of time \"Trigger Record\" will run for. This is read in minutes.",
                   "default": "10",
                   "example": "",
                   "form-group-class": "h_det_input h_det_1",
                   "form-group-class-pre-layer": "h_rec_mtd_input h_rec_mtd_hot h_rec_mtd_sip",
                   "possible": ""
                },
                {
                    hidden: true,
                   "name": "detail=watchdog_reset",
                   "field": lang["Timeout Reset on Next Event"],
                   "description": lang["fieldTextWatchdogReset"],
                   "default": "1",
                   "fieldType": "select",
                   "form-group-class": "h_det_input h_det_1",
                   "form-group-class-pre-layer": "h_rec_mtd_input h_rec_mtd_hot h_rec_mtd_sip",
                   "possible": yesNoPossibility
                },
                {
                    isAdvanced: true,
                    hidden: true,
                   "name": "detail=detector_delete_motionless_videos",
                   "field": lang['Delete Motionless Video'],
                   "default": "0",
                   "form-group-class": "h_det_input h_det_1",
                   "form-group-class-pre-layer": "h_rec_mtd_input h_rec_mtd_del",
                   "fieldType": "select",
                   "possible": yesNoPossibility
                },
                {
                    hidden: true,
                   "name": "detail=det_trigger_tags",
                   "field": lang['Trigger Monitors with Tags'],
                   "form-group-class": "h_det_input h_det_1",
                },
                {
                    isAdvanced: true,
                   "name": "detail=detector_http_api",
                   "field": lang["Allow API Trigger"],
                   "description": lang["fieldTextDetectorHttpApi"],
                   "default": "1",
                   "example": "",
                   "fieldType": "select",
                   "possible": [
                      {
                         "name": `${lang.Always} (${lang.Default})`,
                         "value": "1"
                      },
                      {
                         "name": lang[`When Detector is On`],
                         "value": "2"
                      },
                      {
                         "name": lang[`When Detector is Off`],
                         "value": "3"
                      },
                      {
                         "name": lang.Never,
                         "value": "0"
                      }
                   ]
                },
                {
                    isAdvanced: true,
                    hidden: true,
                   "name": "detail=detector_send_frames",
                   "field": lang["Send Frames"],
                   "description": lang["fieldTextDetectorSendFrames"],
                   "default": "0",
                   "example": "",
                   "selector": "h_det_fra",
                   "form-group-class": "h_det_input h_det_1",
                   "fieldType": "select",
                   "possible": yesNoPossibility
                },
                {
                    isAdvanced: true,
                    hidden: true,
                    "form-group-class": "h_det_input h_det_1",
                   "name": "detail=detector_fps",
                   "field": lang["Detector Rate"],
                   "description": lang["fieldTextDetectorFps"],
                   "default": "2",
                   "example": "",
                   "possible": ""
                },
                {
                    isAdvanced: true,
                    hidden: true,
                    "form-group-class": "h_det_input h_det_1",
                   "name": "detail=detector_scale_x",
                   "field": lang["Feed-in Image Width"],
                   "description": lang["fieldTextDetectorScaleX"],
                   "default": "",
                   "example": "640",
                   "possible": ""
                },
                {
                    isAdvanced: true,
                    hidden: true,
                    "form-group-class": "h_det_input h_det_1",
                   "name": "detail=detector_scale_y",
                   "field": lang["Feed-in Image Height"],
                   "description": lang["fieldTextDetectorScaleY"],
                   "default": "",
                   "example": "480",
                   "possible": ""
                },
                {
                    isAdvanced: true,
                    hidden: true,
                   "name": "detail=detector_lock_timeout",
                   "field": lang['Allow Next Trigger'],
                   "description": lang["fieldTextDetectorLockTimeout"],
                   "default": "2000",
                   "example": "",
                   "form-group-class": "h_det_input h_det_1",
                   "possible": ""
                },
                {
                    isAdvanced: true,
                   "name": "detail=detector_send_video_length",
                   "field": lang["Notification Video Length"],
                   "description": lang["fieldTextDetectorSendVideoLength"],
                   "default": "10"
                },
                {
                    isAdvanced: true,
                   "name": "detail=snap_seconds_inward",
                   "field": lang['Delay for Snapshot'],
                   "description": lang[lang["fieldTextSnapSecondsInward"]],
                   "default": "5"
                },
                {
                    hidden: true,
                   "name": "detail=cords",
                },
                {
                    hidden: true,
                   "name": "detail=detector_filters",
                },
                {
                    hidden: true,
                    "name": lang['Motion Detection'],
                    "headerTitle": `${lang['Motion Detection']} <small>${lang['Primary Engine']} : <b class="h_det_pam_input h_det_pam_1">Pixel Array</b><span class="h_det_pam_input h_det_pam_0"><b class="shinobi-detector_name"></b> <b class="shinobi-detector-invert">${lang['Not Connected']}</b><b class="shinobi-detector" style="display:none">${lang['Connected']}</b></span></small>`,
                    "color": "orange",
                    id: "monSectionDetectorMotion",
                    isSection: true,
                    isFormGroupGroup: true,
                    "section-class": "h_det_input h_det_1",
                    "info": [
                        {
                           "name": "detail=detector_pam",
                           "field": lang["Use Built-In"],
                           "description": lang["fieldTextDetectorPam"],
                           "selector": "h_det_pam",
                           "default": "0",
                           "example": "",
                           "fieldType": "select",
                           "possible": yesNoPossibility
                        },
                        {
                            isAdvanced: true,
                           "name": "detail=detector_motion_save_frame",
                           "field": lang["Save Frames"],
                           "description": lang["fieldTextSaveFrames"],
                           "default": "0",
                           "fieldType": "select",
                           "possible": yesNoPossibility
                        },
                        // {
                        //    "name": "detail=detector_show_matrix",
                        //    "field": lang["Show Matrices"],
                        //    "description": "Outline which pixels are detected as changed in one matrix.",
                        //    "default": "0",
                        //    "example": "",
                        //    "fieldType": "select",
                        //    "form-group-class": "h_det_pam_input h_det_pam_1",
                        //    "possible": [
                        //       {
                        //          "name": lang.No,
                        //          "value": "0"
                        //       },
                        //       {
                        //          "name": lang.Yes,
                        //          "value": "1"
                        //       }
                        //    ]
                        // },
                        {
                           "name": "detail=detector_sensitivity",
                           "field": lang['Minimum Change'],
                           "description": "The motion confidence rating must exceed this value to be seen as a trigger. This number correlates directly to the confidence rating returned by the motion detector. This option was previously named \"Indifference\".",
                           "default": "10",
                           "example": "10",
                           "possible": ""
                        },
                        {
                           "name": "detail=detector_max_sensitivity",
                           "field": lang["Maximum Change"],
                           "description": "The motion confidence rating must be lower than this value to be seen as a trigger. Leave blank for no maximum. This option was previously named \"Max Indifference\".",
                           "default": "",
                           "example": "75",
                           "possible": ""
                        },
                        {
                            isAdvanced: true,
                           "name": "detail=detector_threshold",
                           "field": lang["Trigger Threshold"],
                           "description": lang["fieldTextDetectorThreshold"],
                           "default": "1",
                           "example": "3",
                           "possible": "Any non-negative integer."
                        },
                        {
                            isAdvanced: true,
                           "name": "detail=detector_color_threshold",
                           "field": lang["Color Threshold"],
                           "description": lang["fieldTextDetectorColorThreshold"],
                           "default": "9",
                           "example": "9",
                           "possible": "Any non-negative integer."
                        },
                        {
                            isAdvanced: true,
                           "name": "detail=inverse_trigger",
                           "field": lang["Inverse Trigger"],
                           "description": lang["fieldTextInverseTrigger"],
                           "default": "0",
                           "example": "",
                           "fieldType": "select",
                           "possible": yesNoPossibility
                        },
                        {
                           "name": "detail=detector_frame",
                           "field": lang["Full Frame Detection"],
                           "description": lang["fieldTextDetectorFrame"],
                           "default": "1",
                           "example": "",
                           "fieldType": "select",
                           "possible": yesNoPossibility
                        },
                        {
                           "name": "detail=detector_motion_tile_mode",
                           "field": lang['Accuracy Mode'],
                           "selector": "h_det_tile_mode",
                           "default": "1",
                           "example": "",
                           "fieldType": "select",
                           "possible": yesNoPossibility
                        },
                        {
                            "form-group-class": "h_det_tile_mode_input h_det_tile_mode_1",
                           "name": "detail=detector_tile_size",
                           "field": lang["Tile Size"],
                           "description": lang.fieldTextTileSize,
                           "default": "20",
                        },
                        {
                            isAdvanced: true,
                           "name": "detail=detector_noise_filter",
                           "field": lang['Noise Filter'],
                           "description": lang["fieldTextDetectorNoiseFilter"],
                           "default": "1",
                           "example": "",
                           "fieldType": "select",
                           "possible": yesNoPossibility
                        },
                        {
                            isAdvanced: true,
                           "name": "detail=detector_noise_filter_range",
                           "field": lang["Noise Filter Range"],
                           "description": lang["fieldTextDetectorNoiseFilterRange"],
                           "default": "6",
                           "example": "9",
                           "possible": "Any non-negative integer."
                        },
                    ]
                },
                {
                   "name": lang['Object Detection'],
                   "color": "orange",
                   id: "monSectionDetectorObject",
                   headerTitle: `${lang['Object Detection']} <small><b class="shinobi-detector_name"></b> <b class="shinobi-detector-invert">${lang['Not Connected']}</b><b class="shinobi-detector" style="display:none">${lang['Connected']}</b></small>`,
                   isFormGroupGroup: true,
                   isSection: true,
                   "input-mapping": "detector_object",
                   "section-class": "h_det_input h_det_1",
                   "info": [
                       {
                          "name": "detail=detector_use_detect_object",
                          "field": lang.Enabled,
                          "description": lang["fieldTextDetectorUseDetectObject"],
                          "default": "0",
                          "example": "",
                          "selector": "h_casc",
                          "fieldType": "select",
                          "possible": yesNoPossibility
                      },
                      {
                          hidden: true,
                          "id": "detectorsSelected",
                         "name": "detail=detectors_selected",
                         "field": lang["Detectors Selected"],
                         "description": lang.fieldTextDetectorsSelected,
                         "default": "all",
                         "attribute": "multiple",
                         "fieldType": "select",
                         "form-group-class": "h_casc_input h_casc_1",
                         "possible": [
                            {
                               "name": `${lang.All} (${lang.Default})`,
                               "value": "all"
                            }
                         ]
                      },
                      {
                         "name": "detail=detector_object_ignore_not_move",
                         "field": lang["Ignore Non-Moving"],
                         "default": "0",
                         "fieldType": "select",
                         "selector": "h_obj_ignore_move",
                         "form-group-class": "h_casc_input h_casc_1",
                         "possible": yesNoPossibility
                      },
                      {
                          hidden: true,
                         "name": "detail=detector_object_move_percent",
                         "field": lang['Minimum Movement'],
                         "description": lang.inPercent,
                         "default": "5",
                         "form-group-class": "h_obj_ignore_move_input h_obj_ignore_move_1"
                      },
                      {
                          isAdvanced: true,
                         "name": "detail=detector_send_frames_object",
                         "field": lang["Send Frames"],
                         "description": lang["fieldTextDetectorSendFramesObject"],
                         "default": "1",
                         "fieldType": "select",
                         "form-group-class": "h_casc_input h_casc_1",
                         "possible": yesNoPossibility
                      },
                      {
                          isAdvanced: true,
                          hidden: true,
                         "name": "detail=detector_obj_count_in_region",
                         "field": lang["Count Objects only inside Regions"],
                         "description": lang["fieldTextDetectorObjCountInRegion"],
                         "default": "0",
                         "example": "",
                         "form-group-class": "h_det_count_input h_det_count_1",
                         "fieldType": "select",
                         "possible": yesNoPossibility
                      },
                      {
                         "name": "detail=detector_obj_region",
                         "field": lang['Require Object to be in Region'],
                         "description": "",
                         "default": "1",
                         "example": "",
                         "fieldType": "select",
                         "form-group-class": "h_casc_input h_casc_1",
                         "possible": yesNoPossibility
                      },
                      {
                          isAdvanced: true,
                         "name": "detail=detector_use_motion",
                         "field": lang['Check for Motion First'],
                         "description": "",
                         "default": "1",
                         "example": "",
                         "selector": "h_det_mot_fir",
                         "fieldType": "select",
                         "form-group-class": "h_casc_input h_casc_1",
                         "possible": yesNoPossibility
                     },
                     {
                         hidden: true,
                        "name": "detail=detector_fps_object",
                        "field": lang['Frame Rate'],
                        "description": "",
                        "default": "2",
                        "example": "",
                        "form-group-class": "h_casc_input h_casc_1",
                        "possible": ""
                     },
                     {
                         isAdvanced: true,
                         hidden: true,
                        "name": "detail=detector_scale_x_object",
                        "field": lang['Image Width'],
                        "description": "",
                        "default": "1280",
                        "form-group-class": "h_casc_input h_casc_1",
                        "fieldType": "number",
                        "numberMin": "1",
                        "possible": ""
                     },
                     {
                         isAdvanced: true,
                         hidden: true,
                        "name": "detail=detector_scale_y_object",
                        "field": lang['Image Height'],
                        "description": "",
                        "default": "720",
                        "form-group-class": "h_casc_input h_casc_1",
                        "fieldType": "number",
                        "numberMin": "1",
                        "possible": ""
                     },
                   ]
               },
                {
                   hidden: true,
                  "name": lang['Line Counter'],
                  "color": "orange",
                  id: "monSectionLineCounter",
                  isSection: true,
                  isFormGroupGroup: true,
                  "section-class": "h_det_input h_det_1",
                  "info": [
                        {
                            "name": "detail=detectorLineCounter",
                            "field": lang.Enabled,
                            "description": lang["fieldTextDetectorLineCounter"],
                            "default": "0",
                            "fieldType": "select",
                            "selector": "h_det_line",
                            "possible": yesNoPossibility
                        },
                        {
                            "id": "monitorSettings-lineCounter-canvas-container",
                            "form-group-class": "h_det_line_input h_det_line_1",
                            "fieldType": "div",
                            "style": "overflow-x: auto; width: 100%; text-align: center",
                        },
                        {
                            "id": "detector-line-counter-spacing",
                            "form-group-class": "h_det_line_input h_det_line_1",
                            "field": lang['Line Spacing'],
                            "fieldType": "number",
                            "numberMin": "10",
                            "placeholder": "40"
                        },
                        {
                            "name": "detail=detectorLineCounterTags",
                            "form-group-class": "h_det_line_input h_det_line_1",
                            "field": lang['Objects to Count'],
                            "placeholder": "person"
                        },
                        {
                            "id": "monitorSettings-lineCounter-canvas-container",
                            "class": "row",
                            "fieldType": "div",
                            "info": [
                                {
                                    "id": "detector-line-counter-name-down",
                                    "form-group-class": "h_det_line_input h_det_line_1 col-md-6",
                                    "field": lang['Down Label'],
                                    "placeholder": "Down"
                                },
                                {
                                    "id": "detector-line-counter-name-up",
                                    "form-group-class": "h_det_line_input h_det_line_1 col-md-6",
                                    "field": lang['Up Label'],
                                    "placeholder": "Up"
                                }
                            ],
                        },
                        {
                            "id": "detector-line-counter-reset-daily",
                            "form-group-class": "h_det_line_input h_det_line_1",
                            "field": lang['Reset Daily'],
                            "fieldType": "select",
                            "possible": yesNoPossibility
                        }
                    ]
                },
                {
                    hidden: true,
                   "name": lang['Event-Based Recording'],
                   "input-mapping": "detector_sip_buffer",
                   "color": "orange",
                   id: "monSectionDetectorTraditionalRecording",
                   isSection: true,
                   isFormGroupGroup: true,
                   "section-class": "h_det_input h_det_1",
                   "info": [
                       {
                          "name": "detail=detector_buffer_vcodec",
                          "field": lang['HLS Video Encoder'],
                          "description": "",
                          "default": "0",
                          "example": "",
                          "selector": "h_buff",
                          "fieldType": "select",
                          "possible": [
                              {
                                 "name": "Auto",
                                 "value": "auto"
                              },
                              {
                                 "name": "libx264",
                                 "value": "libx264"
                              },
                              {
                                 "name": "H.264 VA-API (Intel HW Accel)",
                                 "value": "h264_vaapi"
                              },
                              {
                                 "name": "H.265 VA-API (Intel HW Accel)",
                                 "value": "hevc_vaapi"
                              },
                              {
                                 "name": lang.copy,
                                 "value": "copy"
                              }
                           ]
                       },
                       {
                          "name": "detail=detector_buffer_acodec",
                          "field": lang['HLS Audio Encoder'],
                          "description": "",
                          "default": "no",
                          "fieldType": "select",
                          "possible": [
                              {
                                 "name": lang['No Audio'],
                                 "value": "no"
                              },
                              {
                                 "name": "Auto",
                                 "value": "auto"
                              },
                              {
                                 "name": "aac",
                                 "value": "aac"
                              },
                              {
                                 "name": "ac3",
                                 "value": "ac3"
                              },
                              {
                                 "name": "libmp3lame",
                                 "value": "libmp3lame"
                              },
                              {
                                 "name": lang.copy,
                                 "value": "copy"
                              }
                           ]
                       },
                       {
                          "name": "detail=detector_buffer_fps",
                          "field": lang['Frame Rate'],
                          "description": "",
                          "default": "30",
                          "example": "",
                          "form-group-class": "h_buff_input h_buff_libx264 h_buff_h264_vaapi h_buff_hevc_vaapi",
                          "possible": ""
                       },
                       {
                          "name": "detail=event_record_scale_x",
                          "field": lang.Width,
                          "description": lang["fieldTextEventRecordScaleX"],
                          "default": "",
                          "fieldType": "number",
                          "numberMin": "1",
                          "example": "640",
                          "form-group-class": "h_buff_input h_buff_libx264 h_buff_h264_vaapi h_buff_hevc_vaapi",
                          "possible": ""
                       },
                       {
                          "name": "detail=event_record_scale_y",
                          "field": lang.Height,
                          "description": lang["fieldTextEventRecordScaleY"],
                          "default": "",
                          "fieldType": "number",
                          "numberMin": "1",
                          "example": "480",
                          "form-group-class": "h_buff_input h_buff_libx264 h_buff_h264_vaapi h_buff_hevc_vaapi",
                          "possible": ""
                       },
                       {
                           name: 'detail=event_record_aduration',
                           field: lang['Analyzation Duration'],
                           default: '1000',
                       },
                       {
                           name: 'detail=event_record_probesize',
                           field: lang['Probe Size'],
                           default: '32',
                       },
                       {
                          "name": "detail=detector_record_overlap",
                          "field": lang['Recording Overlap'],
                          "description": lang.fieldTextRecordingOverlap,
                          "default": "0",
                          "form-group-class-pre-layer": "h_rec_mtd_input h_rec_mtd_hot h_rec_mtd_sip",
                          "fieldType": "select",
                          "possible": yesNoPossibility
                       },
                       {
                          "fieldType": "div",
                          // style: `width:100%;background:#eceaea;border-radius:5px;color:#333;font-family:monospace`,
                          divContent: `<pre><code id="monEditBufferPreview"></code></pre>`
                       },
                   ]
                },
                {
                    hidden: true,
                   "name": lang['Audio Detector'],
                   "color": "orange",
                   id: "monSectionAudioDetector",
                   isSection: true,
                   isFormGroupGroup: true,
                   "section-class": "h_det_input h_det_1",
                   "info": [
                       {
                          "name": "detail=detector_audio",
                          "field": lang.Enabled,
                          "description": lang["fieldTextDetectorAudio"],
                          "default": "0",
                          "example": "",
                          "fieldType": "select",
                          "possible": yesNoPossibility
                      },
                      {
                          "name": "detail=detector_audio_min_db",
                          "field": lang['Minimum dB'],
                          "description": "",
                          "default": "5",
                          "example": "",
                          "possible": ""
                       },
                       {
                          "name": "detail=detector_audio_max_db",
                          "field": lang['Maximum dB'],
                          "description": "",
                          "default": "",
                          "example": "",
                          "possible": ""
                       }
                   ]
               },
                {
                   hidden: true,
                  "name": lang['Event-Based PTZ'],
                  "color": "orange",
                  id: "monSectionEventPtz",
                  isSection: true,
                  isFormGroupGroup: true,
                  "blockquoteClass": "global_tip",
                  "blockquote": lang.eventBasedPtzDescription,
                  "section-class": "h_det_input h_det_1",
                  "info": [
                      {
                         "name": "detail=detectorEventPtz",
                         "field": lang.Enabled,
                         "default": "0",
                         "fieldType": "select",
                         "possible": yesNoPossibility
                      },
                      {
                         "fieldType": "btn",
                         "class": `btn-success monitor-settings-event-ptz-add`,
                         "btnContent": `<i class="fa fa-plus"></i> &nbsp; ${lang['Add Monitor']}`,
                      },
                      {
                          "id": "monitorSettingsEventPtz",
                          "fieldType": "table",
                          "class": "table table-striped",
                      }
                  ]
                },
                {
                    hidden: true,
                    "name": lang['Webhook'],
                    "color": "orange",
                    id: "monSectionDetectorWebhook",
                    isSection: true,
                    isAdvanced: true,
                    isFormGroupGroup: true,
                    "section-class": "h_det_input h_det_1",
                    "info": [
                        {
                           "name": "detail=detector_webhook",
                           "field": "Webhook",
                           "description": lang["fieldTextDetectorWebhook"],
                           "default": "0",
                           "example": "",
                           "selector": "h_det_web",
                           "fieldType": "select",
                           "form-group-class-pre-layer": "h_det_input h_det_1",
                           "possible": yesNoPossibility
                        },
                        {
                           "name": "detail=detector_webhook_timeout",
                           "field": lang['Allow Next Webhook'],
                           "description": lang["fieldTextDetectorWebhookTimeout"],
                           "default": "10",
                           "example": "",
                           "form-group-class": "h_det_web_input h_det_web_1",
                           "form-group-class-pre-layer": "h_det_input h_det_1",
                           "possible": ""
                        },
                        {
                            hidden: true,
                           "name": "detail=detector_webhook_url",
                           "field": lang['Webhook URL'],
                           "description": "",
                           "default": "",
                           "example": "http://111.111.111.111?mid={{MONITOR_ID}}&group={{GROUP_KEY}}&confidence={{CONFIDENCE}}",
                           "form-group-class": "h_det_web_input h_det_web_1",
                           "form-group-class-pre-layer": "h_det_input h_det_1",
                           "possible": ""
                        },
                        {
                           "name": "detail=detector_webhook_method",
                           "field": lang['Call Method'],
                           "description": "",
                           "default": "GET",
                           "example": "",
                           "form-group-class": "h_det_web_input h_det_web_1",
                           "form-group-class-pre-layer": "h_det_input h_det_1",
                           "fieldType": "select",
                           "possible": [
                               {
                                  "name": `GET (${lang.Default})`,
                                  "value": "GET"
                               },
                               {
                                  "name": "PUT",
                                  "value": "PUT"
                               },
                               {
                                  "name": "POST",
                                  "value": "POST"
                               }
                            ]
                        },
                    ]
                },
                {
                    hidden: true,
                    "name": lang['Command'],
                    "color": "orange",
                    id: "monSectionDetectorCommand",
                    isSection: true,
                    isAdvanced: true,
                    isFormGroupGroup: true,
                    "section-class": "h_det_input h_det_1",
                    "info": [
                        {
                           "name": "detail=detector_command_enable",
                           "field": lang['Command on Trigger'],
                           "description": "",
                           "default": "0",
                           "example": "",
                           "selector": "h_det_com",
                           "fieldType": "select",
                           "form-group-class-pre-layer": "h_det_input h_det_1",
                           "possible": yesNoPossibility
                        },
                        {
                           "name": "detail=detector_command",
                           "field": lang['Command'],
                           "description": lang["fieldTextDetectorCommand"],
                           "default": "",
                           "form-group-class": "h_det_com_input h_det_com_1",
                           "example": "/home/script.sh {{MONITOR_ID}} {{GROUP_KEY}} {{CONFIDENCE}}",
                           "form-group-class-pre-layer": "h_det_input h_det_1",
                           "possible": ""
                        },
                        {
                           "name": "detail=detector_command_timeout",
                           "field": lang['Allow Next Command'],
                           "description": lang["fieldTextDetectorCommandTimeout"],
                           "default": "10",
                           "example": "",
                           "form-group-class": "h_det_com_input h_det_com_1",
                           "form-group-class-pre-layer": "h_det_input h_det_1",
                           "possible": ""
                        },
                    ]
                },
                {
                    hidden: true,
                   "name": lang['\"No Motion"\ Detector'],
                   "color": "orange",
                   id: "monSectionNoMotionDetector",
                   isSection: true,
                   isAdvanced: true,
                   isFormGroupGroup: true,
                   "section-class": "h_det_input h_det_1",
                   "info": [
                       {
                          "name": "detail=detector_notrigger",
                          "field": lang.Enabled,
                          "description": lang["fieldTextDetectorNotrigger"],
                          "default": "0",
                          "example": "",
                          "fieldType": "select",
                          "possible": yesNoPossibility
                      },
                      {
                         "name": "detail=detector_notrigger_timeout",
                         "field": lang.Timeout,
                         "description": lang["fieldTextDetectorNotriggerTimeout"],
                         "default": "10",
                         "example": "",
                         "possible": ""
                      },
                      {
                         "name": "detail=detector_notrigger_discord",
                         "field": lang['No Trigger'],
                         "description": lang["fieldTextDetectorNotriggerDiscord"],
                         "default": "0",
                         "example": "",
                         "fieldType": "select",
                         "possible": yesNoPossibility
                      },
                     {
                        "name": "detail=detector_notrigger_webhook",
                        "field": "Webhook",
                        "description": lang["fieldTextDetectorNotriggerWebhook"],
                        "default": "0",
                        "example": "",
                        "selector": "h_det_web_notrig",
                        "fieldType": "select",
                        "possible": yesNoPossibility
                     },
                     {
                         hidden: true,
                        "name": "detail=detector_notrigger_webhook_url",
                        "field": lang['Webhook URL'],
                        "description": "",
                        "default": "",
                        "example": "http://111.111.111.111?mid={{MONITOR_ID}}&group={{GROUP_KEY}}&confidence={{CONFIDENCE}}",
                        "form-group-class": "h_det_web_notrig_input h_det_web_notrig_1",
                        "possible": ""
                     },
                     {
                        "name": "detail=detector_notrigger_webhook_method",
                        "field": lang['Call Method'],
                        "description": "",
                        "default": "GET",
                        "example": "",
                        "form-group-class": "h_det_web_notrig_input h_det_web_notrig_1",
                        "fieldType": "select",
                        "possible": [
                            {
                               "name": `GET (${lang.Default})`,
                               "value": "GET"
                            },
                            {
                               "name": "PUT",
                               "value": "PUT"
                            },
                            {
                               "name": "POST",
                               "value": "POST"
                            }
                         ]
                     },
                     {
                        "name": "detail=detector_notrigger_command_enable",
                        "field": lang['Command on Trigger'],
                        "description": "",
                        "default": "0",
                        "example": "",
                        "selector": "h_det_com_notrig",
                        "fieldType": "select",
                        "possible": yesNoPossibility
                     },
                     {
                        "name": "detail=detector_notrigger_command",
                        "field": lang['Command'],
                        "description": lang["fieldTextDetectorNotriggerCommand"],
                        "default": "",
                        "form-group-class": "h_det_com_notrig_input h_det_com_notrig_1",
                        "example": "/home/script.sh {{MONITOR_ID}} {{GROUP_KEY}} {{CONFIDENCE}}",
                        "possible": ""
                     },
                     {
                        "name": "detail=detector_notrigger_command_timeout",
                        "field": lang['Allow Next Command'],
                        "description": lang["fieldTextDetectorNotriggerCommandTimeout"],
                        "default": "10",
                        "example": "",
                        "form-group-class": "h_det_com_notrig_input h_det_com_notrig_1",
                        "possible": ""
                     },
                   ]
                },
             ]
          },
          "Control": {
             "name": lang.Control,
             "color": "blue",
             id: "monSectionControl",
             isSection: true,
             "info": [
                 {
                    "name": "detail=control",
                    "field": lang.Controllable,
                    "description": "",
                    "default": "0",
                    "example": "",
                    "selector": "h_c",
                    "fieldType": "select",
                    "possible": yesNoPossibility
                 },
                 {
                    "name": "detail=control_base_url",
                    "field": lang['Custom Base URL'],
                    "description": "",
                    "default": "",
                    "example": "http://111.111.111.111:8080",
                    "form-group-class": "h_c_input h_c_1",
                    "possible": ""
                 },
                 {
                    "name": "detail=control_url_method",
                    "field": lang['Call Method'],
                    "description": "",
                    "default": "0",
                    "example": "",
                    "selector": "h_control_call",
                    "fieldType": "select",
                    "possible": [
                        {
                           "name": `GET (${lang.Default})`,
                           "value": "GET"
                        },
                        {
                           "name": "PUT",
                           "value": "PUT"
                        },
                        {
                           "name": "POST",
                           "value": "POST"
                        },
                        {
                           "name": "ONVIF",
                           "value": "ONVIF"
                        }
                     ]
                 },
                 {
                    "name": "detail=onvif_non_standard",
                    "field": lang['ONVIF Home Control'],
                    "description": lang.fieldTextOnvifHomeControl,
                    "default": "0",
                    "form-group-class": "h_control_call_input h_control_call_ONVIF",
                    "fieldType": "select",
                    "possible": [
                        {
                           "name": lang.usingPreset1,
                           "value": "0"
                        },
                        {
                           "name": lang.usingPreset1HikvisionClone,
                           "value": "1"
                        },
                        {
                           "name": lang.usingHomePreset,
                           "value": "2"
                        }
                    ]
                 },
                 {
                     isAdvanced: true,
                    "name": "detail=control_digest_auth",
                    "field": lang['Digest Authentication'],
                    "default": "0",
                    "fieldType": "select",
                    "form-group-class": "h_control_call_input h_control_call_GET h_control_call_PUT h_control_call_POST",
                    "possible": yesNoPossibility
                 },
                 {
                     isAdvanced: true,
                    "name": "detail=control_axis_lock",
                    "field": lang['Pan/Tilt Only'],
                    "default": "",
                    "fieldType": "select",
                    "possible": [
                       {
                          "name": lang['Pan and Tilt'],
                          "value": ""
                       },
                       {
                          "name": lang['Pan Only'],
                          "value": "1"
                       },
                       {
                          "name": lang['Tilt Only'],
                          "value": "2"
                       }
                    ]
                 },
                 {
                    "name": "detail=control_stop",
                    "field": lang['Stop Command'],
                    "description": "",
                    "default": "0",
                    "example": "",
                    "selector": "h_cs",
                    "fieldType": "select",
                    "form-group-class": "h_control_call_input h_control_call_GET h_control_call_ONVIF h_control_call_PUT h_control_call_POST",
                    "possible": [
                       {
                          "name": lang.No,
                          "value": "0"
                       },
                       {
                          "name": lang.Timed,
                          "value": "1"
                       },
                       {
                          "name": lang['On Release'],
                          "value": "2"
                       }
                    ]
                 },
                 {
                    "name": "detail=control_url_stop_timeout",
                    "field": lang['URL Stop Timeout'],
                    "description": "",
                    "default": "1000",
                    "example": "",
                    "form-group-class": "h_cs_input h_cs_1",
                    "possible": ""
                 },
                 {
                    "name": "detail=control_turn_speed",
                    "field": lang['Turn Speed'],
                    "description": "",
                    "default": "0.1",
                    "example": "",
                    "form-group-class": "h_control_call_input h_control_call_ONVIF",
                    "possible": ""
                 },
                 {
                    "name": "detail=detector_ptz_follow",
                    "field": lang['PTZ Tracking'],
                    "description": lang["fieldTextDetectorPtzFollow"],
                    "default": "0",
                    "example": "",
                    "selector": "h_det_tracking",
                    "fieldType": "select",
                    "possible": yesNoPossibility
                 },
                 {
                    "name": "detail=detector_ptz_follow_target",
                    "field": lang['PTZ Tracking Target'],
                    "description": "",
                    "default": "person",
                    "example": "",
                    "form-group-class": "h_det_tracking_input h_det_tracking_1",
                    "possible": ""
                 },
                 // {
                 //    "name": "detail=detector_obj_count",
                 //    "field": lang["Count Objects"],
                 //    "description": lang["fieldTextDetectorObjCount"],
                 //    "default": "0",
                 //    "example": "",
                 //    "selector": "h_det_count",
                 //    "fieldType": "select",
                 //    "possible": [
                 //       {
                 //          "name": lang.No,
                 //          "value": "0"
                 //       },
                 //       {
                 //          "name": lang.Yes,
                 //          "value": "1"
                 //       }
                 //    ]
                 // },
                 {
                    "name": "detail=control_url_center",
                    "field": lang['Center'],
                    "description": "",
                    "default": "/",
                    "example": "",
                    "form-group-class": "h_control_call_input h_control_call_GET h_control_call_PUT h_control_call_POST",
                    "possible": ""
                 },
                 {
                    "name": "detail=control_url_left",
                    "field": lang['Left'],
                    "description": "",
                    "default": "/",
                    "example": "",
                    "form-group-class": "h_control_call_input h_control_call_GET h_control_call_PUT h_control_call_POST",
                    "possible": ""
                 },
                 {
                    "name": "detail=control_url_left_stop",
                    "field": lang['Left Stop'],
                    "description": "",
                    "default": "/",
                    "example": "",
                    "form-group-class-pre-layer": "h_cs_input h_cs_1 h_cs_2",
                    "form-group-class": "h_control_call_input h_control_call_GET h_control_call_PUT h_control_call_POST",
                    "possible": ""
                 },
                 {
                    "name": "detail=control_url_right",
                    "field": lang['Right'],
                    "description": "",
                    "default": "/",
                    "example": "",
                    "form-group-class": "h_control_call_input h_control_call_GET h_control_call_PUT h_control_call_POST",
                    "possible": ""
                 },
                 {
                    "name": "detail=control_url_right_stop",
                    "field": lang['Right Stop'],
                    "description": "",
                    "default": "/",
                    "example": "",
                    "form-group-class-pre-layer": "h_cs_input h_cs_1 h_cs_2",
                    "form-group-class": "h_control_call_input h_control_call_GET h_control_call_PUT h_control_call_POST",
                    "possible": ""
                 },
                 {
                    "name": "detail=control_url_up",
                    "field": lang['Up'],
                    "description": "",
                    "default": "/",
                    "example": "",
                    "form-group-class": "h_control_call_input h_control_call_GET h_control_call_PUT h_control_call_POST",
                    "possible": ""
                 },
                 {
                    "name": "detail=control_url_up_stop",
                    "field": lang['Up Stop'],
                    "description": "",
                    "default": "/",
                    "example": "",
                    "form-group-class-pre-layer": "h_cs_input h_cs_1 h_cs_2",
                    "form-group-class": "h_control_call_input h_control_call_GET h_control_call_PUT h_control_call_POST",
                    "possible": ""
                 },
                 {
                    "name": "detail=control_url_down",
                    "field": lang['Down'],
                    "description": "",
                    "default": "/",
                    "example": "",
                    "form-group-class": "h_control_call_input h_control_call_GET h_control_call_PUT h_control_call_POST",
                    "possible": ""
                 },
                 {
                    "name": "detail=control_url_down_stop",
                    "field": lang['Down Stop'],
                    "description": "",
                    "default": "/",
                    "example": "",
                    "form-group-class-pre-layer": "h_cs_input h_cs_1 h_cs_2",
                    "form-group-class": "h_control_call_input h_control_call_GET h_control_call_PUT h_control_call_POST",
                    "possible": ""
                 },
                 {
                    "name": "detail=control_url_enable_nv",
                    "field": lang['Enable Night Vision'],
                    "description": "",
                    "default": "/",
                    "example": "",
                    "form-group-class": "h_control_call_input h_control_call_GET h_control_call_PUT h_control_call_POST",
                    "possible": ""
                 },
                 {
                    "name": "detail=control_url_disable_nv",
                    "field": lang['Disable Night Vision'],
                    "description": "",
                    "default": "/",
                    "example": "",
                    "form-group-class": "h_control_call_input h_control_call_GET h_control_call_PUT h_control_call_POST",
                    "possible": ""
                 },
                 {
                    "name": "detail=control_url_zoom_out",
                    "field": lang['Zoom Out'],
                    "description": "",
                    "default": "/",
                    "example": "",
                    "form-group-class": "h_control_call_input h_control_call_GET h_control_call_PUT h_control_call_POST",
                    "possible": ""
                 },
                 {
                    "name": "detail=control_url_zoom_out_stop",
                    "field": lang['Zoom Out Stop'],
                    "description": "",
                    "default": "/",
                    "example": "",
                    "form-group-class-pre-layer": "h_cs_input h_cs_1 h_cs_2",
                    "form-group-class": "h_control_call_input h_control_call_GET h_control_call_PUT h_control_call_POST",
                    "possible": ""
                 },
                 {
                    "name": "detail=control_url_zoom_in",
                    "field": lang['Zoom In'],
                    "description": "",
                    "default": "/",
                    "example": "",
                    "form-group-class": "h_control_call_input h_control_call_GET h_control_call_PUT h_control_call_POST",
                    "possible": ""
                 },
                 {
                    "name": "detail=control_url_zoom_in_stop",
                    "field": lang['Zoom In Stop'],
                    "description": "",
                    "default": "/",
                    "example": "",
                    "form-group-class-pre-layer": "h_cs_input h_cs_1 h_cs_2",
                    "form-group-class": "h_control_call_input h_control_call_GET h_control_call_PUT h_control_call_POST",
                    "possible": ""
                 },
                 {
                     isAdvanced: true,
                    "name": "detail=control_invert_y",
                    "field": lang["Invert Y-Axis"],
                    "description": lang["fieldTextControlInvertY"],
                    "default": "0",
                    "example": "",
                    "fieldType": "select",
                    "possible": yesNoPossibility
                 },
             ]
          },
          "Copy Settings": {
             id: "monSectionCopying",
            "name": lang['Copy Settings'],
            "color": "orange",
             isSection: true,
             "box-wrapper-class": "row",
            "info": [
                {
                   "id": "copy_settings",
                   "field": lang['Copy to Selected Monitor(s)'],
                   "description": "",
                   "default": "0",
                   "example": "",
                   "selector": "h_copy_settings",
                   "fieldType": "select",
                   "possible": yesNoPossibility
                },
                {
                   "field": lang['Copy Mode'],
                   "description": "",
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "attribute": `copy="field=mode"`,
                   "form-group-class": "h_copy_settings_input h_copy_settings_1",
                   "form-group-class-pre-layer": "col-md-6",
                   "possible": yesNoPossibility
                },
                {
                   "field": lang['Copy Tags'],
                   "description": "",
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "attribute": `copy="field=tags"`,
                   "form-group-class": "h_copy_settings_input h_copy_settings_1",
                   "form-group-class-pre-layer": "col-md-6",
                   "possible": yesNoPossibility
                },
                {
                   "field": lang['Compress Completed Videos'],
                   "default": "0",
                   "fieldType": "select",
                   "attribute": `copy="field=detail=auto_compress_videos"`,
                   "form-group-class": "h_copy_settings_input h_copy_settings_1",
                   "form-group-class-pre-layer": "col-md-6",
                   "possible": yesNoPossibility
                },
                {
                   "field": lang['Stream Channels'],
                   "description": "",
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "attribute": `copy="field=detail=stream_channels"`,
                   "form-group-class": "h_copy_settings_input h_copy_settings_1",
                   "form-group-class-pre-layer": "col-md-6",
                   "possible": yesNoPossibility
                },
                {
                   "field": lang['Connection'],
                   "description": "",
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "attribute": `copy="#monSectionConnection"`,
                   "form-group-class": "h_copy_settings_input h_copy_settings_1",
                   "form-group-class-pre-layer": "col-md-6",
                   "possible": yesNoPossibility
                },
                {
                   "field": lang['Input'],
                   "description": "",
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "attribute": `copy="#monSectionInput"`,
                   "form-group-class": "h_copy_settings_input h_copy_settings_1",
                   "form-group-class-pre-layer": "col-md-6",
                   "possible": yesNoPossibility
                },
                {
                   "field": lang['Timelapse'],
                   "description": "",
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "attribute": `copy="#monSectionTimelapse"`,
                   "form-group-class": "h_copy_settings_input h_copy_settings_1",
                   "form-group-class-pre-layer": "col-md-6",
                   "possible": yesNoPossibility
                },
                {
                   "field": lang['Stream'],
                   "description": "",
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "attribute": `copy="#monSectionStream,#monSectionStreamTimestamp,#monSectionStreamWatermark"`,
                   "form-group-class": "h_copy_settings_input h_copy_settings_1",
                   "form-group-class-pre-layer": "col-md-6",
                   "possible": yesNoPossibility
                },
                {
                   "field": lang['JPEG API'],
                   "description": "",
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "attribute": `copy="#monSectionJPEGAPI"`,
                   "form-group-class": "h_copy_settings_input h_copy_settings_1",
                   "form-group-class-pre-layer": "col-md-6",
                   "possible": yesNoPossibility
                },
                {
                   "field": lang['Recording'],
                   "description": "",
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "attribute": `copy="#monSectionRecording,#monSectionRecordingTimestamp,#monSectionRecordingWatermark"`,
                   "form-group-class": "h_copy_settings_input h_copy_settings_1",
                   "form-group-class-pre-layer": "col-md-6",
                   "possible": yesNoPossibility
                },
                {
                   "field": lang['Detector Settings'],
                   "description": "",
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "attribute": `copy="#monSectionDetector,#monSectionDetectorBuffer,#monSectionLisencePlateDetector,#monSectionNoMotionDetector"`,
                   "form-group-class": "h_copy_settings_input h_copy_settings_1",
                   "form-group-class-pre-layer": "col-md-6",
                   "possible": yesNoPossibility
                },
                {
                   "field": lang['Regions'],
                   "fieldType": "select",
                   "attribute": `copy="field=detail=cords"`,
                   "form-group-class": "h_copy_settings_input h_copy_settings_1",
                   "form-group-class-pre-layer": "col-md-6",
                   "possible": yesNoPossibility
                },
                {
                   "field": lang['Control'],
                   "description": "",
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "attribute": `copy="#monSectionControl"`,
                   "form-group-class": "h_copy_settings_input h_copy_settings_1",
                   "form-group-class-pre-layer": "col-md-6",
                   "possible": yesNoPossibility
                },
                {
                   "field": lang['Custom'],
                   "description": "",
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "attribute": `copy="#monSectionCustom"`,
                   "form-group-class": "h_copy_settings_input h_copy_settings_1",
                   "form-group-class-pre-layer": "col-md-6",
                   "possible": yesNoPossibility
                },
                {
                   "field": lang['Grouping'],
                   "description": "",
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "attribute": `copy="#monSectionGrouping"`,
                   "form-group-class": "h_copy_settings_input h_copy_settings_1",
                   "form-group-class-pre-layer": "col-md-6",
                   "possible": yesNoPossibility
                },
                {
                   "field": lang['Logging'],
                   "description": "",
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "attribute": `copy="#monSectionLogging"`,
                   "form-group-class": "h_copy_settings_input h_copy_settings_1",
                   "form-group-class-pre-layer": "col-md-6",
                   "possible": yesNoPossibility
                },
                {
                   "field": lang['Monitors to Copy to'],
                   "description": "",
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "attribute": "multiple",
                    id: 'copy_settings_monitors',
                   "form-group-class": "h_copy_settings_input h_copy_settings_1",
                   "possible": [
                      {
                         "name": lang['New Monitor'],
                         "value": "$New"
                      },
                      {
                         "name": lang['Monitors'],
                         "optgroup": []
                      }
                   ]
                },
            ],
          },
          "Notifications": {
             "name": lang['Notifications'],
             "color": "blue",
             "isSection": true,
             "id": "monSectionNotifications",
             "info": [
                 {
                    "name": lang.Methods,
                    "color": "blue",
                     isFormGroupGroup: true,
                    "info": [

                    ],
                 },
                {
                   "name": "detail=notify_onUnexpectedExit",
                   "field": lang['On Unexpected Exit'],
                   "default": "0",
                   "example": "1",
                   "fieldType": "select",
                   "possible": yesNoPossibility
                },
                {
                   "name": "detail=notify_useRawSnapshot",
                   "field": lang['Use Raw Snapshot'],
                   "default": "0",
                   "example": "1",
                   "fieldType": "select",
                   "possible": yesNoPossibility
                }
            ]
          },
          "Custom": {
             "name": lang.Custom,
             "color": "navy",
             "isSection": true,
             isAdvanced: true,
             "id": "monSectionCustom",
             "info": [
                {
                   "name": "detail=cust_input",
                   "field": lang['Input Flags'],
                   "description": lang["fieldTextCustInput"],
                   "default": "",
                   "example": "",
                   "possible": ""
                },
                // {
                //     hidden: true,
                //    "name": "detail=cust_rtmp",
                //    "field": lang['RTMP Stream Flags'],
                //    "description": "Custom Flags that bind to the RTMP stream.",
                //    "default": "",
                //    "example": "",
                //    "form-group-class": "h_rtmp_input h_rtmp_1",
                //    "possible": ""
                // },
                {
                   "name": "detail=cust_stream",
                   "field": lang["Stream Flags"],
                   "description": lang["fieldTextCustStream"],
                   "default": "",
                   "example": "",
                   "form-group-class": "",
                   "possible": ""
                },
                {
                    hidden: true,
                   "name": "detail=cust_snap",
                   "field": lang["JPEG API Flags"],
                   "description": lang["fieldTextCustSnap"],
                   "form-group-class": "h_sn_input h_sn_1",
                },
                {
                    hidden: true,
                   "name": "detail=cust_snap_raw",
                   "field": lang["Snapshot Flags"],
                   "description": lang["fieldTextCustSnap"],
                },
                {
                    hidden: true,
                   "name": "detail=cust_record",
                   "field": lang["Recording Flags"],
                   "description": lang["fieldTextCustRecord"],
                   "form-group-class": "h_m_input h_m_record",
                },
                {
                    hidden: true,
                   "name": "detail=cust_detect",
                   "field": lang["Detector Flags"],
                   "description": lang["fieldTextCustDetect"],
                   "default": "",
                   "example": "",
                   "form-group-class": "shinobi-detector",
                   "possible": ""
                },
                {
                    hidden: true,
                   "name": "detail=cust_detect_object",
                   "field": lang["Object Detector Flags"],
                   "description": lang["fieldTextCustDetectObject"],
                   "form-group-class": "shinobi-detector",
                },
                {
                    hidden: true,
                   "name": "detail=cust_sip_record",
                   "field": lang['Event-Based Recording Flags'],
                   "description": lang["fieldTextCustSipRecord"],
                   "default": "",
                   "example": "",
                   "form-group-class": "h_rec_mtd_input h_rec_mtd_sip",
                   "possible": ""
                },
                {
                   "name": "detail=custom_output",
                   "field": "Output Method",
                   "description": lang["fieldTextCustomOutput"],
                   "default": "",
                   "example": "",
                   "form-group-class": "",
                   "possible": ""
                }
             ]
          },
          "Logging": {
             "name": lang.Logging,
             "color": "green",
             id: "monSectionLogging",
             isSection: true,
             "info": [
                {
                   "name": "detail=loglevel",
                   "field": lang['Log Level'],
                   "description": lang["fieldTextLoglevel"],
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "possible": [
                        {
                           "name": lang.Silent,
                           "value": "quiet",
                           "info": lang["fieldTextLoglevelSilent"]
                        },
                        {
                           "name": lang.Fatal,
                           "value": "fatal",
                           "info": lang["fieldTextLoglevelFatal"]
                        },
                        {
                           "name": lang['on Error'],
                           "value": "error",
                           "info": lang["fieldTextLoglevelOnError"]
                        },
                        {
                           "name": lang['All Warnings'],
                           "value": "warning",
                           "info": lang["fieldTextLoglevelAllWarnings"]
                        }
                     ]
                },
                {
                   "name": "detail=sqllog",
                   "field": lang["Save Log in SQL"],
                   "description": lang["fieldTextSqllog"],
                   "default": "0",
                   "example": "",
                   "fieldType": "select",
                   "possible": yesNoPossibility
               },
               {
                  "name": "Log Stream",
                  "color": "green",
                   isFormGroupGroup: true,
                  "info": [
                      {
                          "fieldType": 'div',
                          "class": "data-menu logs"
                      },
                  ],
               },
             ]
         },
          "Hidden": {
              hidden: true,
             "name": "",
             "color": "",
             isSection: true,
             "info": [
                 {
                    "name": "details",
                    "preFill": "{}",
                 }
             ]
          }
       }
    }
}
