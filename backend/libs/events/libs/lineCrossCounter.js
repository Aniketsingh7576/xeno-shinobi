class LineCrossCounter {
    constructor(imageWidth, imageHeight, lines = [], tags = ['person']) {
        this.imageWidth = imageWidth;
        this.imageHeight = imageHeight;

        // Line configuration (default: two horizontal lines)
        this.lines = lines.length >= 2 ? lines : [
            { start: { x: 0, y: 194 }, end: { x: imageWidth, y: 194 } },
            { start: { x: 0, y: 220 }, end: { x: imageWidth, y: 220 } }
        ];

        this.tags = Array.isArray(tags) ? tags : [tags];
        this.offset = 15;

        // Tracking state
        this.resetCounters();
        this.frameCount = 0;
        this.startTime = new Date();
        this.lastFrameTime = null;
        this.autoResetEnabled = false;
        this.resetHour = 0; // Midnight (12:00 AM)
        this.resetMinute = 0;
        this.lastResetCheck = null;

        this.calculateLineEquations();

        this.trackingHistory = new Map();
        this.historyDuration = 10000;
    }

    enableDailyReset(hour = 0, minute = 0) {
        this.autoResetEnabled = true;
        this.resetHour = hour;
        this.resetMinute = minute;
        this.lastResetCheck = new Date();
        return `Daily reset enabled at ${hour}:${minute.toString().padStart(2, '0')}`;
    }

    disableDailyReset() {
        this.autoResetEnabled = false;
        return "Daily reset disabled";
    }

    checkForDailyReset() {
        if (!this.autoResetEnabled) return false;

        const now = new Date();
        this.lastResetCheck = now;

        // Check if we've crossed the reset time
        if (now.getHours() === this.resetHour &&
            now.getMinutes() === this.resetMinute) {

            // Don't reset multiple times in the same minute
            const lastReset = this.lastDailyReset || new Date(0);
            if (now.getTime() - lastReset.getTime() > 60000) {
                this.resetCounters();
                this.lastDailyReset = now;
                return true;
            }
        }
        return false;
    }

    resetCounters() {
        this.counts = {
            total: { down: 0, up: 0 },
            byTag: this.createEmptyTagCounts()
        };
        this.currentNearLine1 = new Set(); // Format: `${id}:${tag}`
        this.currentNearLine2 = new Set();
    }

    createEmptyTagCounts() {
        return this.tags.reduce((acc, tag) => {
            acc[tag] = { down: 0, up: 0 };
            return acc;
        }, {});
    }

    calculateLineEquations() {
        this.lineEqs = this.lines.map(line => {
            const { start, end } = line;
            const A = end.y - start.y;
            const B = start.x - end.x;
            const C = (end.x * start.y) - (start.x * end.y);

            return {
                A, B, C,
                minX: Math.min(start.x, end.x),
                maxX: Math.max(start.x, end.x),
                minY: Math.min(start.y, end.y),
                maxY: Math.max(start.y, end.y)
            };
        });
    }

    isPointNearLine(x, y, lineIndex) {
        const line = this.lineEqs[lineIndex];
        if (x < line.minX - this.offset || x > line.maxX + this.offset ||
            y < line.minY - this.offset || y > line.maxY + this.offset) {
            return false;
        }
        const distance = Math.abs(line.A * x + line.B * y + line.C) /
                       Math.sqrt(line.A * line.A + line.B * line.B);
        console.log('distance',distance, 'line : ' + lineIndex,', pass :',distance <= this.offset)
        return distance <= this.offset;
    }

    processDetections(detections) {
        this.checkForDailyReset();
        this.lastFrameTime = new Date();
        this.frameCount++;

        // Clean up old history entries
        const now = Date.now();
        for (const [id, entry] of this.trackingHistory.entries()) {
            if (now - entry.lastSeen > this.historyDuration) {
                this.trackingHistory.delete(id);
            }
        }

        if (this.frameCount % 3 !== 0) {
            return {
                frameResult: this.getCounts(),
                changedCount: {
                    total: { down: 0, up: 0 },
                    byTag: {}
                }
            };
        }

        const filtered = detections.filter(d => d.tag && this.tags.includes(d.tag));
        const newNearLine1 = new Set();
        const newNearLine2 = new Set();
        const changedCount = {
            total: { down: 0, up: 0 },
            byTag: this.createEmptyTagCounts()
        };

        // Process each detection
        filtered.forEach(detection => {
            const { x, y, width, height, id, tag } = detection;
            const cx = Math.floor(x + width / 2);
            const cy = Math.floor(y + height / 2);
            const idTag = `${id}:${tag}`;

            // Update tracking history
            if (!this.trackingHistory.has(id)) {
                this.trackingHistory.set(id, {
                    lastSeen: now,
                    positions: [],
                    tag: tag
                });
            }
            const history = this.trackingHistory.get(id);
            history.lastSeen = now;
            history.positions.push({ x: cx, y: cy, timestamp: now });

            // Keep only recent positions
            history.positions = history.positions.filter(
                pos => now - pos.timestamp <= this.historyDuration
            );

            // Check line proximity
            const nearLine1 = this.isPointNearLine(cx, cy, 0);
            const nearLine2 = this.isPointNearLine(cx, cy, 1);

            if (nearLine1) newNearLine1.add(idTag);
            if (nearLine2) newNearLine2.add(idTag);

            // Check historical positions for crossings
            if (history.positions.length > 1) {
                const crossedLine1To2 = this.checkHistoricalCrossing(history.positions, 0, 1);
                const crossedLine2To1 = this.checkHistoricalCrossing(history.positions, 1, 0);

                if (crossedLine1To2 && !this.countedCrossings.has(`${id}:down`)) {
                    this.counts.total.down++;
                    this.counts.byTag[tag].down++;
                    changedCount.total.down++;
                    changedCount.byTag[tag].down++;
                    this.countedCrossings.add(`${id}:down`);
                }

                if (crossedLine2To1 && !this.countedCrossings.has(`${id}:up`)) {
                    this.counts.total.up++;
                    this.counts.byTag[tag].up++;
                    changedCount.total.up++;
                    changedCount.byTag[tag].up++;
                    this.countedCrossings.add(`${id}:up`);
                }
            }
        });

        this.currentNearLine1 = newNearLine1;
        this.currentNearLine2 = newNearLine2;

        const filteredChangedTags = Object.fromEntries(
            Object.entries(changedCount.byTag).filter(
                ([_, counts]) => counts.down !== 0 || counts.up !== 0
            )
        );

        return {
            frameResult: this.getCounts(),
            changedCount: {
                total: changedCount.total,
                byTag: filteredChangedTags
            }
        };
    }

    checkHistoricalCrossing(positions, fromLineIndex, toLineIndex) {
        // Check if object crossed from one line to another in its position history
        let wasNearFromLine = false;

        for (const pos of positions) {
            const nearFromLine = this.isPointNearLine(pos.x, pos.y, fromLineIndex);
            const nearToLine = this.isPointNearLine(pos.x, pos.y, toLineIndex);

            if (nearFromLine) wasNearFromLine = true;
            if (wasNearFromLine && nearToLine) return true;
        }

        return false;
    }

    getCounts() {
        return {
            total: this.counts.total,
            byTag: this.counts.byTag,
            lines: this.lines,
            frameCount: this.frameCount,
            activeTags: this.tags,
            timestamps: {
                start: this.startTime.toISOString(),
                lastFrame: this.lastFrameTime?.toISOString() || null
            }
        };
    }

    updateLines(newLines) {
        if (newLines.length >= 2) {
            this.lines = newLines;
            this.calculateLineEquations();
            return true;
        }
        return false;
    }

    updateTags(newTags) {
        this.tags = Array.isArray(newTags) ? newTags : [newTags];
        // Initialize counts for new tags
        this.tags.forEach(tag => {
            if (!this.counts.byTag[tag]) {
                this.counts.byTag[tag] = { down: 0, up: 0 };
            }
        });
        // Remove old tags
        Object.keys(this.counts.byTag).forEach(tag => {
            if (!this.tags.includes(tag)) {
                delete this.counts.byTag[tag];
            }
        });
    }
}

module.exports = LineCrossCounter;
