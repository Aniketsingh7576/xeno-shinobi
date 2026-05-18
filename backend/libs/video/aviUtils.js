const { spawn } = require('child_process')
module.exports = (s,config,lang) => {
    const {
        splitForFFMPEG,
    } = require('../ffmpeg/utils.js')(s,config,lang)
    async function convertAviToMp4(options) {
        return new Promise((resolve, reject) => {
            const inputAviFile = options.input;
            const outputMp4File = options.output;
            const quality = options.quality || 'medium'; // 'low', 'medium', 'high'
            const crf = options.crf || (quality === 'low' ? 28 : quality === 'high' ? 18 : 23);

            // Check if input file has audio
            const probeCommand = `-i "${inputAviFile}" -show_streams -select_streams a -loglevel error`;
            const probeProcess = spawn(config.ffmpegDir, splitForFFMPEG(probeCommand));

            let hasAudio = false;
            let audioCodec = 'aac';

            probeProcess.stdout.on('data', function(data) {
                const output = data.toString();
                if (output.includes('codec_type=audio')) {
                    hasAudio = true;
                    // Detect audio codec to determine if we need to re-encode
                    if (output.includes('codec_name=aac')) {
                        audioCodec = 'copy'; // Can copy if already AAC
                    } else if (output.includes('codec_name=mp3')) {
                        audioCodec = 'libmp3lame'; // Keep MP3 if source is MP3
                    }
                }
            });

            probeProcess.on('exit', function() {
                // Build FFmpeg command based on whether audio exists and quality preferences
                let commandString;

                if (hasAudio) {
                    commandString = `-y -i "${inputAviFile}" ` +
                        `-c:v libx264 -crf ${crf} -preset ${getPreset(quality)} ` +
                        `-pix_fmt yuv420p -movflags +faststart ` +
                        `-c:a ${audioCodec} -b:a ${getAudioBitrate(quality)} ` +
                        `-ac 2 -ar 44100 ` +
                        `"${outputMp4File}"`;
                } else {
                    commandString = `-y -i "${inputAviFile}" ` +
                        `-c:v libx264 -crf ${crf} -preset ${getPreset(quality)} ` +
                        `-pix_fmt yuv420p -movflags +faststart ` +
                        `-an ` + // No audio
                        `"${outputMp4File}"`;
                }

                s.debugLog("convertAviToMp4", commandString);

                const conversionProcess = spawn(config.ffmpegDir, splitForFFMPEG(commandString));

                conversionProcess.stdout.on('data', function(data) {
                    s.debugLog('stdout', outputMp4File, data.toString());
                });

                conversionProcess.stderr.on('data', function(data) {
                    s.debugLog('stderr', outputMp4File, data.toString());
                });

                conversionProcess.on('exit', function(code) {
                    if (code === 0) {
                        resolve({
                            output: outputMp4File,
                            hasAudio: hasAudio,
                            quality: quality
                        });
                    } else {
                        reject(new Error(`FFmpeg process exited with code ${code}`));
                    }
                });

                conversionProcess.on('error', function(err) {
                    reject(err);
                });
            });

            probeProcess.on('error', function(err) {
                reject(new Error(`Failed to probe input file: ${err.message}`));
            });
        });
    }

    // Helper functions for quality settings
    function getPreset(quality) {
        const presets = {
            'low': 'fast',
            'medium': 'medium',
            'high': 'slow'
        };
        return presets[quality] || 'medium';
    }

    function getAudioBitrate(quality) {
        const bitrates = {
            'low': '96k',
            'medium': '128k',
            'high': '192k'
        };
        return bitrates[quality] || '128k';
    }

    return {
        convertAviToMp4,
        getPreset,
        getAudioBitrate,
    }
}
