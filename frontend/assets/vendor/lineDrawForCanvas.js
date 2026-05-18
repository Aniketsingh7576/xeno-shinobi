class ParallelLineDrawer {
    constructor(canvasId, options = {}) {
        // Configuration with defaults
        this.lineSpacing = options.lineSpacing || 40;
        this.refreshRate = options.refreshRate || 10;
        this.onLinesDrawn = options.onLinesDrawn || null;

        // Ratio handling
        this.originalWidth = options.originalWidth || null;
        this.originalHeight = options.originalHeight || null;
        this.currentRatio = 1; // Default ratio (no scaling)

        // Canvas setup
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");

        // Set initial canvas size if original dimensions provided
        if (this.originalWidth && this.originalHeight) {
            this.resizeCanvas(this.originalWidth, this.originalHeight);
        }

        // State variables
        this.cursorX = 0;
        this.cursorY = 0;
        this.firstClick = [0, 0];
        this.intervalLoop = null;
        this.isActive = false;
        this.currentLines = null;

        // Bind event handlers
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.startDragLine = this.startDragLine.bind(this);
        this.stopDragLine = this.stopDragLine.bind(this);

        this.initialize();
    }

    resizeCanvas(width, height) {
        this.originalWidth = width;
        this.originalHeight = height;
        this.canvas.width = width;
        this.canvas.height = height;
        this.currentRatio = 1;
        this.redrawLines();
    }

    scaleCanvas(scaleFactor) {
        if (!this.originalWidth || !this.originalHeight) return;

        this.currentRatio = scaleFactor;
        this.canvas.width = this.originalWidth * scaleFactor;
        this.canvas.height = this.originalHeight * scaleFactor;
        this.redrawLines();
    }

    initialize() {
        document.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mousedown', this.startDragLine);
        this.canvas.addEventListener('mouseup', this.stopDragLine);
        this.canvas.addEventListener('mouseleave', this.stopDragLine);
        this.isActive = true;
    }

    destroy() {
        this.stopDragLine();
        document.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mousedown', this.startDragLine);
        this.canvas.removeEventListener('mouseup', this.stopDragLine);
        this.canvas.removeEventListener('mouseleave', this.stopDragLine);
        this.isActive = false;
    }

    // Load previous state (lines, spacing, refresh rate)
    loadState(state) {
        if (!state) return;

        // Restore configuration
        if (state.lineSpacing) this.lineSpacing = state.lineSpacing;
        if (state.refreshRate) this.refreshRate = state.refreshRate;
        if (state.originalWidth && state.originalHeight) {
            this.originalWidth = state.originalWidth;
            this.originalHeight = state.originalHeight;
            this.scaleCanvas(state.currentRatio || 1);
        }

        // Restore lines with ratio adjustment
        if (state.lines && Array.isArray(state.lines) && state.lines.length === 2) {
            this.currentLines = state.lines.map(line => ({
                start: {
                    x: line.start.x * this.currentRatio,
                    y: line.start.y * this.currentRatio
                },
                end: {
                    x: line.end.x * this.currentRatio,
                    y: line.end.y * this.currentRatio
                }
            }));
            this.redrawLines();
        }
    }

    // Redraw existing lines
    redrawLines() {
        if (!this.currentLines) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawLine(this.currentLines[0], '#FF0000'); // Red
        this.drawLine(this.currentLines[1], '#0000FF'); // Blue
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.cursorX = e.clientX - rect.left;
        this.cursorY = e.clientY - rect.top;
    }

    startDragLine(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.firstClick = [
            e.clientX - rect.left,
            e.clientY - rect.top
        ];

        this.intervalLoop = setInterval(() => {
            // Check if mouse is at edge of screen
            if (this.cursorX <= 0 || this.cursorY <= 0 ||
                this.cursorX >= this.canvas.width || this.cursorY >= this.canvas.height) {
                this.stopDragLine();
                return;
            }

            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            // Calculate offsets for parallel lines
            const angle = Math.atan2(
                this.cursorY - this.firstClick[1],
                this.cursorX - this.firstClick[0]
            );
            const perpendicularAngle = angle + Math.PI/2;
            const offsetX = Math.cos(perpendicularAngle) * (this.lineSpacing/2);
            const offsetY = Math.sin(perpendicularAngle) * (this.lineSpacing/2);

            // Calculate line coordinates
            this.currentLines = [
                {
                    start: {
                        x: this.firstClick[0] - offsetX,
                        y: this.firstClick[1] - offsetY
                    },
                    end: {
                        x: this.cursorX - offsetX,
                        y: this.cursorY - offsetY
                    }
                },
                {
                    start: {
                        x: this.firstClick[0] + offsetX,
                        y: this.firstClick[1] + offsetY
                    },
                    end: {
                        x: this.cursorX + offsetX,
                        y: this.cursorY + offsetY
                    }
                }
            ];

            // Draw lines with colors
            this.drawLine(this.currentLines[0], '#FF0000'); // Red
            this.drawLine(this.currentLines[1], '#0000FF'); // Blue

        }, this.refreshRate);
    }

    drawLine(coords, color) {
        this.ctx.beginPath();
        this.ctx.moveTo(coords.start.x, coords.start.y);
        this.ctx.lineTo(coords.end.x, coords.end.y);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    stopDragLine() {
        if (this.intervalLoop) {
            clearInterval(this.intervalLoop);
            this.intervalLoop = null;

            if (this.onLinesDrawn && this.currentLines) {
                this.onLinesDrawn(this.getCurrentLines());
            }
        }
    }

    // Returns current state (lines + configuration)
    getState() {
        return {
            lines: this.getCurrentLines(),
            lineSpacing: this.lineSpacing,
            refreshRate: this.refreshRate,
            originalWidth: this.originalWidth,
            originalHeight: this.originalHeight,
            currentRatio: this.currentRatio
        };
    }

    getCurrentLines() {
        if (!this.currentLines) return null;

        // Return lines in original coordinates (divide by current ratio)
        const newLines = this.currentLines.map(line => ({
            start: {
                x: line.start.x / this.currentRatio,
                y: line.start.y / this.currentRatio
            },
            end: {
                x: line.end.x / this.currentRatio,
                y: line.end.y / this.currentRatio
            }
        }));
        console.log(newLines,this.currentLines[0].start.x,this.currentRatio)
        return newLines
    }

    // Configuration setters
    setLineSpacing(spacing) {
        this.lineSpacing = spacing;
    }

    setRefreshRate(rate) {
        this.refreshRate = rate;
    }

    setCallback(callback) {
        this.onLinesDrawn = callback;
    }
}
